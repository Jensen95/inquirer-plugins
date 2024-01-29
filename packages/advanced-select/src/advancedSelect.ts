import {
  createPrompt,
  useState,
  useRef,
  useKeypress,
  usePrefix,
  usePagination,
  isUpKey,
  isDownKey,
  isSpaceKey,
  isBackspaceKey,
  isEnterKey,
  Separator,
} from "@inquirer/core";
import chalk from "chalk";
import figures from "figures";
import ansiEscapes from "ansi-escapes";
import { fuzzyMatch, removeScore } from "fuzzy-match";
import { isVimArrowBinding } from "is-vim-arrow-binding";

export type AdvancedSelectChoice<Value> = {
  name?: string;
  value: Value;
  disabled?: boolean | string;
  checked?: boolean;
  id?: string;
  type?: never;
};

type Config<Value> = {
  prefix?: string;
  pageSize: number;
  instructions?: string | boolean;
  message: string;
  choices: ReadonlyArray<Item<Value>>;
};

type Item<Value> = AdvancedSelectChoice<Value> | Separator;

interface RenderItemParams<T> {
  item: Item<T>;
  isActive: boolean;
}
const isSelectableChoice = <T>(
  choice: undefined | Item<T>,
): choice is AdvancedSelectChoice<T> => {
  return choice != null && !Separator.isSeparator(choice) && !choice.disabled;
};

const renderItem = <T>(renderItem?: RenderItemParams<T>) => {
  if (renderItem == null) {
    return "No results found";
  }
  const { item, isActive } = renderItem;
  if (Separator.isSeparator(item)) {
    return ` ${item.separator}`;
  }

  const line = item.name || item.value;
  if (item.disabled) {
    const disabledLabel =
      typeof item.disabled === "string" ? item.disabled : "(disabled)";
    return chalk.dim(`- ${line} ${disabledLabel}`);
  }

  const color = isActive ? chalk.cyan : (x: string) => x;
  const prefix = isActive ? figures.pointer : " ";
  return color(`${prefix} ${line}`);
};

export const advancedSelectPrompt = createPrompt(
  <Value extends unknown>(
    config: Config<Value>,
    done: (value: Value) => void,
  ): string => {
    const { prefix = usePrefix(), instructions, pageSize } = config;
    const initialChoices = useRef(
      config.choices.map(
        (choice, choiceIndex) =>
          ({
            ...choice,
            id:
              isSelectableChoice(choice) && choice.id != null
                ? choice.id
                : `INTERNAL_${choiceIndex}`,
          }) as (Separator | AdvancedSelectChoice<Value>) & { id: string },
      ),
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
            done(choice.value);
          }
          return;
        }

        setStatus("done");
        done(
          initialChoices
            .filter((item) => selectedId === item.id)
            .map((choice) => (choice as AdvancedSelectChoice<Value>).value)[0],
        );
        return;
      }

      if (!isVimArrowBinding(key) && (isUpKey(key) || isDownKey(key))) {
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

      if (key.ctrl || key.name === "tab") {
        switch (key.name) {
          case "r":
            setSearch("");
            setChoices(initialChoices);
            setCursorPosition(0);
            return;
          default:
            return;
        }
      }

      const _search = isBackspaceKey(key)
        ? [...search].slice(0, search.length - 1).join("")
        : `${search}${key.name}`;
      setSearch(_search);
      setShowHelpTip(true);

      setChoices(
        fuzzyMatch(_search, initialChoices.filter(isSelectableChoice)).map(
          removeScore,
        ),
      );
      setCursorPosition(0);
    });

    const message = chalk.bold(config.message);

    if (status === "done") {
      const selection = initialChoices
        .filter((item) => selectedId === item.id)
        .map(
          (choice) =>
            (choice as AdvancedSelectChoice<Value>).name ||
            (choice as AdvancedSelectChoice<Value>).value,
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
            "<enter>",
          )} to select and proceed`,
        ];
        helpTip = ` (Press ${keys.join(", ")})`;
      }
    }

    if (search.length > 0) {
      helpTip = `\n${chalk.cyan.bold("<ctrl> + <r>")} to clear search`;
    }

    const windowedChoices = usePagination({
      items: choices,
      renderItem,
      active: cursorPosition,
      pageSize,
    });
    return `${prefix} ${message}${
      search.length > 0 ? " " + chalk.yellow(search) : ""
    }${helpTip}\n${windowedChoices}${ansiEscapes.cursorHide}`;
  },
);

export { Separator };
