import type { DiscoveredSkill, SkillDiscoverySource, SkillSourceKind } from '../../shared/skills'

export type SkillScanRoot = Omit<SkillDiscoverySource, 'exists' | 'skippedReason'>

// Skill classification and ordering are identical for native and WSL discovery;
// only the path arithmetic differs (node:path vs pathPosix), so both callers
// share these and pass the matching path adapter.
type SkillRelativePathApi = { relative: (from: string, to: string) => string; sep: string }

export function sourceKindForSkill(
  root: SkillScanRoot,
  skillFilePath: string,
  pathApi: SkillRelativePathApi
): SkillSourceKind {
  if (
    root.sourceKind === 'home' &&
    pathApi.relative(root.path, skillFilePath).split(pathApi.sep)[0] === '.system'
  ) {
    return 'bundled'
  }
  return root.sourceKind
}

export function sourceLabelForSkill(root: SkillScanRoot, sourceKind: SkillSourceKind): string {
  return sourceKind === 'bundled' ? `${root.label} bundled` : root.label
}

export function sortDiscoveredSkills(skills: DiscoveredSkill[]): DiscoveredSkill[] {
  if (skills.length < 2) {
    return skills
  }
  const compare = new Intl.Collator(undefined, { sensitivity: 'base' }).compare
  return skills.sort(
    (a, b) =>
      compare(a.name, b.name) ||
      compare(a.sourceLabel, b.sourceLabel) ||
      a.skillFilePath.localeCompare(b.skillFilePath)
  )
}

export function sortSkillDiscoverySources(sources: SkillDiscoverySource[]): SkillDiscoverySource[] {
  if (sources.length < 2) {
    return sources
  }
  const compare = new Intl.Collator(undefined, { sensitivity: 'base' }).compare
  return sources.sort((a, b) => compare(a.label, b.label))
}
