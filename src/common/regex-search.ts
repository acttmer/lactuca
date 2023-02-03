export const escapeStringRegExp = (str: string) => {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

export const buildStartsWithRegExp = (search: string, flags = 'i') => {
  return new RegExp(`^${escapeStringRegExp(search)}`, flags)
}

export const buildEndsWithRegExp = (search: string, flags = 'i') => {
  return new RegExp(`${escapeStringRegExp(search)}$`, flags)
}
