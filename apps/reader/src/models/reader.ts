import type { Rendition, Location } from 'epubjs'
import ePub from 'epubjs'
import Navigation, { NavItem } from 'epubjs/types/navigation'
import { proxy, ref } from 'valtio'

import { BookRecord } from '../db'

function updateIndex(array: any[], deletedItemIndex: number) {
  const last = array.length - 1
  return deletedItemIndex > last ? last : deletedItemIndex
}

interface INavItem extends NavItem {
  depth?: number
  expanded?: boolean
}

function flatTree(node: INavItem, depth = 1): INavItem[] {
  if (!node.subitems || !node.subitems.length || !node.expanded) {
    return [{ ...node, depth }]
  }
  const children = node.subitems.flatMap((i) => flatTree(i, depth + 1))
  return [{ ...node, depth }, ...children]
}

function find(nodes: INavItem[] = [], id: string): INavItem | undefined {
  const node = nodes.find((n) => n.id === id)
  if (node) return node
  for (const child of nodes) {
    const node = find(child.subitems, id)
    if (node) return node
  }
  return undefined
}

export class ReaderTab {
  epub = ref(ePub(this.book.data))
  rendition?: Rendition
  nav?: Navigation
  toc: INavItem[] = []
  location?: Location

  calc() {
    this.toc = this.nav?.toc.flatMap((item) => flatTree(item)) ?? []
    console.log(
      '🚀 ~ file: Reader.ts ~ line 45 ~ ReaderTab ~ calc ~ this.toc',
      this.toc,
    )
  }

  toggle(id: string) {
    const item = find(this.nav?.toc, id) as INavItem
    item.expanded = !item.expanded
    this.calc()
  }

  render(el: HTMLDivElement) {
    if (this.rendition) return

    this.epub.loaded.navigation.then((nav) => {
      this.nav = ref(nav)
      this.calc()
    })
    this.rendition = ref(
      this.epub.renderTo(el, {
        width: '100%',
        height: '100%',
        allowScriptedContent: true,
      }),
    )
    this.rendition.display(this.location?.start.cfi)
    this.rendition.on('relocated', (loc: Location) => {
      this.location = ref(loc)
    })
  }

  constructor(public readonly book: BookRecord) {}
}

export class ReaderGroup {
  constructor(
    public tabs: ReaderTab[],
    public selectedIndex = tabs.length - 1,
  ) {}

  get selectedTab() {
    return this.tabs[this.selectedIndex]
  }

  removeTab(index: number) {
    this.tabs.splice(index, 1)
    this.selectedIndex = updateIndex(this.tabs, index)
  }

  addTab(book: BookRecord) {
    const index = this.tabs.findIndex((t) => t.book.id === book.id)
    if (index > -1) {
      this.selectTab(index)
      return this.tabs[index]
    }

    const tab = new ReaderTab(book)
    this.tabs.splice(++this.selectedIndex, 0, tab)
    return tab
  }

  selectTab(index: number) {
    this.selectedIndex = index
  }
}

export class Reader {
  groups: ReaderGroup[] = []
  focusedIndex = -1

  get focusedGroup() {
    return this.groups[this.focusedIndex]
  }

  get focusedTab() {
    return this.focusedGroup?.selectedTab
  }

  addTab(book: BookRecord, groupIdx = this.focusedIndex) {
    const group = this.groups[groupIdx]
    if (group) return group.addTab(book)
    const tab = new ReaderTab(book)
    this.addGroup([tab])
    return tab
  }

  removeTab(index: number, groupIdx = this.focusedIndex) {
    const group = this.groups[groupIdx]
    if (group?.tabs.length === 1) {
      this.removeGroup(groupIdx)
      return
    }
    group?.removeTab(index)
  }

  removeGroup(index: number) {
    this.groups.splice(index, 1)
    this.focusedIndex = updateIndex(this.groups, index)
  }

  addGroup(tabs: ReaderTab[], index = this.focusedIndex + 1) {
    console.log(index)
    const group = proxy(new ReaderGroup(tabs))
    this.groups.splice(index, 0, group)
    this.focusedIndex = index
    return group
  }

  selectGroup(index: number) {
    this.focusedIndex = index
  }
}
