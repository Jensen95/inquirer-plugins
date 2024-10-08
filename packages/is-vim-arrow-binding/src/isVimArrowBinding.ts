interface KeypressEvent {
  ctrl: boolean
  name: string
}

export const isVimArrowBinding = (key: KeypressEvent): boolean => {
  if (key.ctrl) {
    return false
  }

  switch (key.name) {
    case 'j':
    case 'k':
      return true
    default:
      return false
  }
}
