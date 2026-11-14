export function dropAfter(row, clientY) {
  const { y, height } = row.getBoundingClientRect();
  return clientY > y + height / 2;
}

export function clearDropLine(row) {
  row?.classList.remove('cw2-over', 'cw2-over-after');
}

export function showDropLine(row, after) {
  row.classList.toggle('cw2-over', !after);
  row.classList.toggle('cw2-over-after', after);
}
