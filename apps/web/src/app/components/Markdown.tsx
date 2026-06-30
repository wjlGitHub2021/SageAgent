"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 助手正文按 Markdown 渲染（标题/列表/代码块/表格/粗体等），贴近主流模型输出。
// react-markdown 默认不渲染原始 HTML，天然防 XSS；外链统一新窗口打开。
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
