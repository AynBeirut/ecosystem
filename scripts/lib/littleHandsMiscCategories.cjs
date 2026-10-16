const LITTLE_HANDS_MISC_CATEGORIES = {
  DISPOSBLES: {
    id: 'DISPOSBLES',
    label: 'Disposables',
    categorySupplierId: 'lh-sup-cat-disposables',
  },
};

function littleHandsMiscCategoryIdForName(name) {
  const t = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/dispos/i.test(t)) return 'DISPOSBLES';
  return null;
}

module.exports = {
  LITTLE_HANDS_MISC_CATEGORIES,
  littleHandsMiscCategoryIdForName,
};
