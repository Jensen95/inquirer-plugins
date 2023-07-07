import {
  createPrompt,
  useState,
  useRef,
  useKeypress,
  usePrefix,
  isUpKey,
  isDownKey,
  isSpaceKey,
  isBackspaceKey,
  isEnterKey,
  Paginator,
  Separator,
} from "@inquirer/core";
import chalk from "chalk";
import figures from "figures";
import ansiEscapes from "ansi-escapes";
import { fuzzyMatch, removeScore } from "fuzzy-match";

export type AdvancedCheckboxChoice<Value> = {
  name?: string;
  value: Value;
  disabled?: boolean | string;
  checked?: boolean;
  id?: string;
  type?: never;
};

type Config<Value> = {
  prefix?: string;
  pageSize?: number;
  instructions?: string | boolean;
  message: string;
  choices: ReadonlyArray<AdvancedCheckboxChoice<Value> | Separator>;
};

const isSelectableChoice = <T>(
  choice: undefined | Separator | AdvancedCheckboxChoice<T>
): choice is AdvancedCheckboxChoice<T> => {
  return choice != null && !Separator.isSeparator(choice) && !choice.disabled;
};

export const advancedCheckboxPrompt = createPrompt(
  <Value extends unknown>(
    config: Config<Value>,
    done: (value: Array<Value>) => void
  ): string => {
    const { prefix = usePrefix(), instructions, pageSize } = config;
    const paginator = useRef(new Paginator()).current;
    const initialChoices = useRef(
      config.choices.map(
        (choice, choiceIndex) =>
          ({
            ...choice,
            id:
              isSelectableChoice(choice) && choice.id != null
                ? choice.id
                : `INTERNAL_${choiceIndex}`,
          } as (Separator | AdvancedCheckboxChoice<Value>) & { id: string })
      )
    ).current;

    const [status, setStatus] = useState<"pending" | "done">("pending");
    const [search, setSearch] = useState("");
    const [choices, setChoices] = useState(initialChoices);
    const [selectedId, setSelectedId] = useState<string | null>(() => {
      for (const item of initialChoices) {
        if (isSelectableChoice(item) && item.checked) {
          return item.id;
        }
      }
      return null;
    });
    const [cursorPosition, setCursorPosition] = useState(0);
    const [showHelpTip, setShowHelpTip] = useState(true);

    useKeypress((key) => {
      let newCursorPosition = cursorPosition;
      if (isEnterKey(key) || isSpaceKey(key)) {
        if (selectedId == null) {
          const cursorChoice = choices[cursorPosition];
          const choice = isSelectableChoice(cursorChoice)
            ? cursorChoice
            : false;

          if (choice) {
            setStatus("done");
            setSelectedId(choice.id);
            done([choice.value]);
          }
          return;
        }

        setStatus("done");
        done(
          initialChoices
            .filter((item) => selectedId === item.id)
            .map((choice) => (choice as AdvancedCheckboxChoice<Value>).value)
        );
        return;
      }

      if (isUpKey(key) || isDownKey(key)) {
        const offset = isUpKey(key) ? -1 : 1;
        let selectedOption;

        while (!isSelectableChoice(selectedOption)) {
          newCursorPosition =
            (newCursorPosition + offset + choices.length) % choices.length;
          selectedOption = choices[newCursorPosition];
        }

        setCursorPosition(newCursorPosition);
        return;
      }

      const _search = isBackspaceKey(key)
        ? [...search].slice(0, search.length - 1).join("")
        : `${search}${key.name}`;
      setSearch(_search);
      setShowHelpTip(false);

      setChoices(
        fuzzyMatch(_search, initialChoices.filter(isSelectableChoice)).map(
          removeScore
        )
      );
      setCursorPosition(0);
    });

    const message = chalk.bold(config.message);

    if (status === "done") {
      const selection = initialChoices
        .filter((item) => selectedId === item.id)
        .map(
          (choice) =>
            (choice as AdvancedCheckboxChoice<Value>).name ||
            (choice as AdvancedCheckboxChoice<Value>).value
        );
      return `${prefix} ${message} ${chalk.cyan(selection.join(", "))}`;
    }

    let helpTip = "";
    if (showHelpTip && (instructions === undefined || instructions)) {
      if (typeof instructions === "string") {
        helpTip = instructions;
      } else {
        const keys = [
          `${chalk.cyan.bold("<space>")} or ${chalk.cyan.bold(
            "<enter>"
          )} to select and proceed`,
        ];
        helpTip = ` (Press ${keys.join(", ")})`;
      }
    }

    const allChoices = choices
      .map((choice, index) => {
        if (Separator.isSeparator(choice)) {
          return ` ${choice.separator}`;
        }

        const line = choice.name || choice.value;
        if (choice.disabled) {
          const disabledLabel =
            typeof choice.disabled === "string"
              ? choice.disabled
              : "(disabled)";
          return chalk.dim(`- ${line} ${disabledLabel}`);
        }

        if (index === cursorPosition) {
          return chalk.cyan(`${figures.pointer} ${line}`);
        }

        return ` ${figures.line} ${line}`;
      })
      .join("\n");

    const windowedChoices = paginator.paginate(
      allChoices,
      cursorPosition,
      pageSize
    );
    return `${prefix} ${message}${
      search.length > 0 ? " " + chalk.yellow(search) : ""
    }${helpTip}\n${windowedChoices}${ansiEscapes.cursorHide}`;
  }
);

export { Separator };
