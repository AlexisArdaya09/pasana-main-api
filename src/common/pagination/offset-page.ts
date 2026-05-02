export interface OffsetPage<T> {
  content: T[];
  totalSize: number;
  totalPages: number;
  numberOfElements: number;
  pageNumber: number;
  empty: boolean;
  size: number;
  offset: number;
}

export const MAX_PAGE_SIZE = 100;

export function createOffsetPage<T>(
  content: T[],
  totalSize: number,
  pageNumber: number,
  size: number,
): OffsetPage<T> {
  const totalPages = totalSize === 0 ? 0 : Math.ceil(totalSize / size);
  const offset = pageNumber * size;
  return {
    content,
    totalSize,
    totalPages,
    numberOfElements: content.length,
    pageNumber,
    empty: content.length === 0,
    size,
    offset,
  };
}
