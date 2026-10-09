import type { ReactNode } from 'react'

// Render the text subset used by lesson authors; never execute embedded HTML.
export default function LessonText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index++; continue }
    if (line.startsWith('```')) {
      const block: string[] = []
      index++
      while (index < lines.length && !lines[index].startsWith('```')) block.push(lines[index++])
      index++
      nodes.push(<pre key={nodes.length} style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}><code>{block.join('\n')}</code></pre>)
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      nodes.push(<h3 key={nodes.length}>{heading[2]}</h3>)
      index++; continue
    }
    const ordered = /^\d+[.)]\s/.test(line)
    if (ordered || /^[-*]\s/.test(line)) {
      const items: string[] = []
      const pattern = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/
      while (index < lines.length && pattern.test(lines[index])) items.push(lines[index++].replace(pattern, ''))
      const content = items.map((item, i) => <li key={i}>{item}</li>)
      nodes.push(ordered ? <ol key={nodes.length}>{content}</ol> : <ul key={nodes.length}>{content}</ul>)
      continue
    }
    const paragraph = [line]; index++
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|[-*]\s|\d+[.)]\s)/.test(lines[index])) paragraph.push(lines[index++])
    nodes.push(<p key={nodes.length} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{paragraph.join('\n')}</p>)
  }
  return <div className="lesson-text">{nodes}</div>
}
