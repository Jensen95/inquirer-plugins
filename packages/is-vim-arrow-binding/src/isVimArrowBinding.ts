interface KeypressEvent {
  name: string
  ctrl: boolean
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
