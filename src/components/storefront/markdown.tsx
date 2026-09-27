import type { ReactNode } from "react";
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
    .map((part, index) => {
      if (part.startsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
      if (part.startsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const safe = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(link[2]);
        return safe ? (
          <a key={index} href={link[2]}>
            {link[1]}
          </a>
        ) : (
          link[1]
        );
      }
      return part;
    });
}
/** Raw HTML remains escaped. Links allow only explicit safe schemes. */
export function Markdown({ body }: { body: string }) {
  return (
    <div className="prose-copy">
      {body.split(/\n\s*\n/).map((block, index) => {
        if (block.startsWith("### "))
          return <h3 key={index}>{inline(block.slice(4))}</h3>;
        if (block.startsWith("## "))
          return <h2 key={index}>{inline(block.slice(3))}</h2>;
        if (block.startsWith("# "))
          return <h2 key={index}>{inline(block.slice(2))}</h2>;
        if (/^[-*] /.test(block))
          return (
            <ul key={index}>
              {block.split("\n").map((line, i) => (
                <li key={i}>{inline(line.replace(/^[-*] /, ""))}</li>
              ))}
            </ul>
          );
        if (/^\d+\. /.test(block))
          return (
            <ol key={index}>
              {block.split("\n").map((line, i) => (
                <li key={i}>{inline(line.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        return <p key={index}>{inline(block)}</p>;
      })}
    </div>
  );
}
