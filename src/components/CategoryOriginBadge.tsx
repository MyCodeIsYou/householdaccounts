export function CategoryOriginBadge({ isDefault }: { isDefault?: boolean }) {
  return (
    <span
      className={
        isDefault
          ? 'shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500'
          : 'shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600'
      }
    >
      {isDefault ? '기본' : '추가'}
    </span>
  )
}
