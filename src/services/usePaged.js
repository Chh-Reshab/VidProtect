// Splits a list into pages: const { pageItems, page, setPage, pages } = usePaged(items, 25)
import { useState } from 'react';

export const usePaged = (items, size = 25) => {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1); // a search that shrinks the list never strands you on an empty page
  return { pageItems: items.slice(current * size, current * size + size), page: current, setPage, pages, total: items.length, size };
};
