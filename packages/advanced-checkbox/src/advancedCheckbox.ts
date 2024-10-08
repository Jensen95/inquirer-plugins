import {
  createPrompt,
  isBackspaceKey,
  isDownKey,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  Separator,
  useKeypress,
  usePagination,
  usePrefix,
  useRef,
  useState,
} from '@inquirer/core'
import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import figures from 'figures'
import { fuzzyMatch, removeScore } from 'fuzzy-match'
import { isVimArrowBinding } from 'is-vim-arrow-binding'

export interface AdvancedCheckboxChoice<Value> {
  checked?: boolean
  disabled?: boolean | string
  id?: string
  name?: string
  type?: never
  value: Value
}

interface Config<Value> {
  choices: readonly Item<Value>[]
  instructions?: boolean | string
  message: string
  pageSize: number
  prefix?: string
}

type Item<Value> = AdvancedCheckboxChoice<Value> | Separator

interface RenderItemParams<T> {
  isActive: boolean
  item: Item<T>
}
const isSelectableChoice = <T>(
  choice: Item<T> | undefined,
): choice is AdvancedCheckboxChoice<T> =>
  choice != null && !Separator.isSeparator(choice) && !choice.disabled

const renderItem = <T>(ri?: RenderItemParams<T>) => {
  if (ri == null) {
    return 'No results found'
  }
  const { isActive, item } = ri
  if (Separator.isSeparator(item)) {
    return ` ${item.separator}`
  }

  const line = item.name || item.value
  if (item.disabled) {
    const disabledLabel =
      typeof item.disabled === 'string' ? item.disabled : '(disabled)'
    return chalk.dim(`- ${line} ${disabledLabel}`)
  }

  const checkbox = item.checked
    ? chalk.green(figures.circleFilled)
    : figures.circle
  const color = isActive ? chalk.cyan : (x: string) => x
  const prefix = isActive ? figures.pointer : ' '
  return color(`${prefix}${checkbox} ${line}`)
}

export const advancedCheckboxPrompt = createPrompt(
  <Value extends unknown>(
    config: Config<Value>,
    done: (value: Value[]) => void,
  ): string => {
    const {
      instructions,
      pageSize,
      prefix = usePrefix({ status: 'idle' }),
    } = config
    const initialChoices = useRef(
      config.choices.map(
        (choice, choiceIndex) =>
          ({
            ...choice,
            id:
              isSelectableChoice(choice) && choice.id != null
                ? choice.id
                : `INTERNAL_${choiceIndex}`,
          }) as { id: string } & (AdvancedCheckboxChoice<Value> | Separator),
      ),
    ).current

    const [status, setStatus] = useState<'done' | 'pending'>('pending')
    const [search, setSearch] = useState('')
    const [choices, setChoices] = useState(initialChoices)
    const [selectedChoices, setSelectedChoices] = useState<Set<string>>(() => {
      const preselectedIds = new Set<string>()
      for (const item of initialChoices) {
        if (isSelectableChoice(item) && item.checked) {
          preselectedIds.add(item.id)
        }
      }
      return preselectedIds
    })
    const [cursorPosition, setCursorPosition] = useState(
      initialChoices.findIndex(isSelectableChoice),
    )
    const [showHelpTip, setShowHelpTip] = useState(true)

    useKeypress((key) => {
      let newCursorPosition = cursorPosition
      if (isEnterKey(key)) {
        if (selectedChoices.size === 0) {
          const cursorChoice = choices[cursorPosition]
          const choice = isSelectableChoice(cursorChoice) ? cursorChoice : false

          if (choice) {
            setStatus('done')
            setSelectedChoices(new Set([choice.id]))
            done([choice.value])
          }
          return
        }

        setStatus('done')
        done(
          initialChoices
            .filter((item) => selectedChoices.has(item.id))
            .map((choice) => (choice as AdvancedCheckboxChoice<Value>).value),
        )
        return
      }

      if (!isVimArrowBinding(key) && (isUpKey(key) || isDownKey(key))) {
        const offset = isUpKey(key) ? -1 : 1
        let selectedOption

        while (!isSelectableChoice(selectedOption)) {
          newCursorPosition =
            (newCursorPosition + offset + choices.length) % choices.length
          selectedOption = choices[newCursorPosition]
        }

        setCursorPosition(newCursorPosition)
        return
      }

      if (isSpaceKey(key)) {
        setShowHelpTip(false)
        const cursorChoice = choices[cursorPosition]
        const choice = isSelectableChoice(cursorChoice) ? cursorChoice : false
        if (choice) {
          selectedChoices.has(choice.id)
            ? selectedChoices.delete(choice.id)
            : selectedChoices.add(choice.id)

          setSelectedChoices(new Set(selectedChoices))
        }
        return
      }

      if (key.ctrl || key.name === 'tab') {
        switch (key.name) {
          case 'a': {
            const choiceCount = initialChoices.filter(isSelectableChoice).length
            if (selectedChoices.size === choiceCount) {
              setSelectedChoices(new Set())
              return
            }
            const updatedSelectedChoices = new Set(selectedChoices)
            for (const item of initialChoices) {
              if (isSelectableChoice(item)) {
                updatedSelectedChoices.add(item.id)
              }
            }
            setSelectedChoices(updatedSelectedChoices)
            return
          }
          case 'r':
            setSearch('')
            setChoices(initialChoices)
            setCursorPosition(initialChoices.findIndex(isSelectableChoice))
            return
          case 'tab': {
            const invertedSelectedChoices = new Set<string>()
            for (const item of initialChoices) {
              if (isSelectableChoice(item) && !selectedChoices.has(item.id)) {
                invertedSelectedChoices.add(item.id)
              }
            }
            setSelectedChoices(invertedSelectedChoices)
            return
          }
          default:
            return
        }
      }

      const _search = isBackspaceKey(key)
        ? [...search].slice(0, search.length - 1).join('')
        : `${search}${key.name}`
      setSearch(_search)
      setShowHelpTip(true)

      setChoices(
        fuzzyMatch(_search, initialChoices.filter(isSelectableChoice)).map(
          removeScore,
        ),
      )
      setCursorPosition(0)
    })

    const message = chalk.bold(config.message)

    if (status === 'done') {
      const selection = initialChoices
        .filter((item) => selectedChoices.has(item.id))
        .map(
          (choice) =>
            (choice as AdvancedCheckboxChoice<Value>).name ||
            (choice as AdvancedCheckboxChoice<Value>).value,
        )
      return `${prefix} ${message} ${chalk.cyan(selection.join(', '))}`
    }

    let helpTip = ''
    if (showHelpTip && (instructions === undefined || instructions)) {
      if (typeof instructions === 'string') {
        helpTip = instructions
      } else {
        const keys = [
          `${chalk.cyan.bold('<space>')} to select`,
          `${chalk.cyan.bold('<ctrl> + <a>')} to toggle all`,
          `${chalk.cyan.bold('<tab>')} or ${chalk.cyan.bold(
            '<ctrl> + <i>',
          )} to inverse selection`,
          `and ${chalk.cyan.bold('<enter>')} to proceed`,
          `hit ${chalk.cyan.bold(
            '<enter>',
          )} when item is selected to proceed with highlighted item`,
        ]
        helpTip = ` (Press ${keys.join(', ')})`
      }
    }

    if (search.length > 0) {
      helpTip = `\n${chalk.cyan.bold('<ctrl> + <r>')} to clear search`
    }

    const windowedChoices = usePagination({
      active: cursorPosition,
      items: choices.map((choice) => ({
        ...choice,
        checked: selectedChoices.has(choice.id),
      })),
      pageSize,
      renderItem,
    })
    return `${prefix} ${message}${
      search.length > 0 ? ' ' + chalk.yellow(search) : ''
    }${helpTip}\n${windowedChoices}${ansiEscapes.cursorHide}`
  },
)

export { Separator }
