import type { MenuConfig } from '@/types'

export type DropZone = 'before' | 'after' | 'child'

interface MenuNode {
  menu_key: string
  display_order: number
  parent_menu_key?: string | null
}

function byOrder(a: MenuNode, b: MenuNode): number {
  if (a.display_order !== b.display_order) return a.display_order - b.display_order
  return a.menu_key.localeCompare(b.menu_key)
}

export function childMenus<T extends MenuNode>(menus: T[], parentKey: string): T[] {
  return menus.filter(menu => menu.parent_menu_key === parentKey).sort(byOrder)
}

export function rootMenus<T extends MenuNode>(menus: T[]): T[] {
  const keys = new Set(menus.map(menu => menu.menu_key))
  return menus
    .filter(menu => !menu.parent_menu_key || !keys.has(menu.parent_menu_key))
    .sort(byOrder)
}

function siblings(menus: MenuConfig[], parentKey: string | null): MenuConfig[] {
  return parentKey === null ? rootMenus(menus) : childMenus(menus, parentKey)
}

export function moveMenu(
  menus: MenuConfig[],
  dragKey: string,
  targetKey: string,
  zone: DropZone,
): { menus: MenuConfig[]; error: string | null } {
  if (dragKey === targetKey) return { menus, error: null }
  const drag = menus.find(menu => menu.menu_key === dragKey)
  const target = menus.find(menu => menu.menu_key === targetKey)
  if (!drag || !target) return { menus, error: null }

  const dragHasChildren = childMenus(menus, dragKey).length > 0
  const canNest = zone === 'child' && !target.parent_menu_key && !dragHasChildren
  const nextParent = canNest ? target.menu_key : (target.parent_menu_key ?? null)

  if (nextParent && dragHasChildren) {
    return { menus, error: '하위 메뉴가 있는 항목은 다른 메뉴 아래로 넣을 수 없습니다.' }
  }
  if (nextParent === dragKey) return { menus, error: null }

  const oldParent = drag.parent_menu_key ?? null
  const oldList = siblings(menus, oldParent).filter(menu => menu.menu_key !== dragKey)
  const newListBase = nextParent === oldParent
    ? oldList
    : siblings(menus, nextParent).filter(menu => menu.menu_key !== dragKey)

  const moved: MenuConfig = { ...drag, parent_menu_key: nextParent }
  const inserted = [...newListBase]
  if (canNest) {
    inserted.unshift(moved)
  } else {
    const index = inserted.findIndex(menu => menu.menu_key === targetKey)
    const at = index < 0 ? inserted.length : zone === 'after' ? index + 1 : index
    inserted.splice(at, 0, moved)
  }

  const placement = new Map<string, { display_order: number; parent_menu_key: string | null }>()
  inserted.forEach((menu, index) => {
    placement.set(menu.menu_key, { display_order: index + 1, parent_menu_key: nextParent })
  })
  if (nextParent !== oldParent) {
    oldList.forEach((menu, index) => {
      placement.set(menu.menu_key, { display_order: index + 1, parent_menu_key: oldParent })
    })
  }

  return {
    menus: menus.map(menu => {
      const next = placement.get(menu.menu_key)
      return next ? { ...menu, display_order: next.display_order, parent_menu_key: next.parent_menu_key } : menu
    }),
    error: null,
  }
}

export function menuPlacementUpdates(before: MenuConfig[], after: MenuConfig[]) {
  return after.flatMap(menu => {
    const prev = before.find(item => item.menu_key === menu.menu_key)
    if (!prev) return []
    const parent = menu.parent_menu_key ?? null
    const prevParent = prev.parent_menu_key ?? null
    if (prev.display_order === menu.display_order && prevParent === parent) return []
    return [{ menu_key: menu.menu_key, display_order: menu.display_order, parent_menu_key: parent }]
  })
}
