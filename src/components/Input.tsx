import React, { useState, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { SYM_USER, ACCENT, PASTE_PERSIST_CHARS } from '../config.js';
import { COMMANDS, COMMAND_DESCRIPTIONS } from '../commands.js';
import { getClipboardImage } from '../clipboard.js';
import { compressImage } from '../tools.js';
import { getState, setAskResolver } from '../store.js';
import { fmtSize } from '../lib/format.js';
import { persistToolOutput } from '../lib/persist.js';
import type { PastedImg } from '../agent.js';

interface Props {
  onSubmit: (text: string, images: PastedImg[]) => void;
  promptLabel?: string; // ask 模式自定义前缀
}

const COMMAND_WINDOW = 6;

// 输入框 + Tab 命令补全 + Ctrl-V 粘贴剪贴板图片 + 大段文本粘贴折叠 + ask 模式 resolve。
// ESC 中断流式在 App.tsx 全局处理。
export default function Input({ onSubmit, promptLabel }: Props) {
  const [value, setValue] = useState('');
  const [compIdx, setCompIdx] = useState(-1);
  const [feedback, setFeedback] = useState('');
  // 折叠发生时 bump：强制 TextInput 重挂载，内部光标 state 重建贴到新值末尾——
  // 否则光标停在标记中间，一打字就破坏标记、提交时正则失配（review #2）
  const [inputEpoch, setInputEpoch] = useState(0);
  const pasted = useRef(new Map<number, PastedImg>());
  const nextId = useRef(1);
  // 大段文本粘贴折叠（对齐 CC 的 [Pasted text #1 +17 lines]）：原文存 Map，
  // 输入框只留标记，提交时还原——长粘贴不再撑爆输入区渲染
  const pastedTexts = useRef(new Map<number, string>());
  const nextTextId = useRef(1);

  const isAsk = getState().askResolver !== null;

  const matches = useMemo(() => {
    if (isAsk) return []; // ask 模式不补全命令
    if (value.startsWith('/') && !value.includes(' ')) return COMMANDS.filter(c => c.startsWith(value.slice(1)));
    return [];
  }, [value, isAsk]);

  const selectedIdx = matches.length > 0
    ? Math.min(Math.max(compIdx, 0), matches.length - 1)
    : -1;
  const windowStart = selectedIdx >= 0
    ? Math.max(0, Math.min(selectedIdx - 2, matches.length - COMMAND_WINDOW))
    : 0;
  const visibleMatches = matches.slice(windowStart, windowStart + COMMAND_WINDOW);

  useInput((input, key) => {
    if (key.upArrow && matches.length) {
      setCompIdx(i => {
        const current = i >= 0 ? i : 0;
        return (current - 1 + matches.length) % matches.length;
      });
    } else if (key.downArrow && matches.length) {
      setCompIdx(i => {
        const current = i >= 0 ? i : 0;
        return (current + 1) % matches.length;
      });
    } else if (key.tab && matches.length) {
      setCompIdx(i => {
        const next = (i + 1) % matches.length;
        setValue('/' + matches[next]); // Tab 即时补全到输入框
        return next;
      });
    }
    if (key.ctrl && input === 'v') void doPaste();
  });

  async function doPaste() {
    const raw = getClipboardImage();
    if (!raw) { setFeedback('剪贴板里没有图片'); return; }
    const { data, mediaType } = await compressImage(raw, '.png');
    const id = nextId.current++;
    pasted.current.set(id, { data, mediaType, dims: '?' });
    // 抹掉 TextInput 在 ctrl+v 时误追加的 'v'（它没拦截 ctrl+v），再插入 [Image #N]
    setValue(v => v.replace(/v$/, '') + `[Image #${id}] `);
    setFeedback(`✓ Image #${id} · ${mediaType} · ${fmtSize(data.length)}`);
  }

  // 粘贴判定：onChange 的新值相对旧值突增一大段（bracketed paste 一次性到达）。
  // 仅多行粘贴（≥3 行）折叠——单行再长（长 URL/路径）保持可读可编辑，
  // 行数按去尾换行后的段数计（"a\nb\n" 是 2 行不是 3 行，review #11）。
  // 已知限制：仅覆盖空框/末尾粘贴（拿不到光标位置，中间粘贴原样不折叠）。
  function collapsePaste(prev: string, next: string): string | null {
    if (!next.startsWith(prev)) return null; // 非末尾追加（空框粘贴 prev='' 同样命中）
    const inserted = next.slice(prev.length);
    const trimmed = inserted.replace(/\n+$/, '');
    const lines = trimmed === '' ? 1 : trimmed.split('\n').length;
    if (lines < 3) return null;
    const id = nextTextId.current++;
    pastedTexts.current.set(id, inserted);
    const size = `+${lines} lines`;
    setFeedback(`✓ 粘贴文本 #${id} · ${size}`);
    setInputEpoch(e => e + 1); // 光标贴尾（见 state 声明处注释）
    return `${prev}[Pasted text #${id} ${size}] `;
  }

  // 清空附件状态（两 Map + 计数器 + 提示行）。所有提交/放弃路径都必须走这里，
  // 残留条目会把旧粘贴内容错注入后续消息（review #7）
  function clearAttachments() {
    pasted.current.clear();
    pastedTexts.current.clear();
    nextId.current = 1;
    nextTextId.current = 1;
    setFeedback('');
  }

  const submit = () => {
    const useComp = selectedIdx >= 0 && value.startsWith('/') && !value.includes(' ') && !isAsk;
    const raw = useComp ? '/' + matches[selectedIdx] : value;
    setValue('');
    setCompIdx(-1);
    if (!raw.trim()) { clearAttachments(); return; }

    // ① 先扫 [Image #N]（在用户输入框原文上）：粘贴文本里若含 "[Image #1]" 字面量，
    //    后续还原出来只是普通文本，不会被再次当附件收集——两族标记隔离（review #6）
    const imgs: PastedImg[] = [];
    let text = raw.replace(/\[Image #(\d+)\]/g, (m, n) => {
      const img = pasted.current.get(Number(n));
      if (img) imgs.push(img);
      return m;
    });
    // ② 还原 [Pasted text #N]（连同尾随空格一起消费，防泄漏进消息，review #12）。
    //    ask/confirm 分支也用还原后的 text——折叠原文不能丢（review #1）
    text = text.replace(/\[Pasted text #(\d+)[^\]]*\] ?/g, (m, n) => pastedTexts.current.get(Number(n)) ?? m);

    // ask 模式：resolve askResolver
    const s = getState();
    if (s.askResolver) {
      s.askResolver(text);
      setAskResolver(null);
      clearAttachments();
      return;
    }

    // ③ 超长粘贴落盘（再生配方，对齐 bash/web_fetch 大输出策略）：全文进上下文
    //    既炸 scrollback 又每轮重发——截断保留头部 + 路径供 read 取回（review #8）
    if (text.length > PASTE_PERSIST_CHARS) {
      const saved = persistToolOutput('paste', text);
      if (saved) {
        text = text.slice(0, PASTE_PERSIST_CHARS / 2) +
          `\n\n[粘贴内容共 ${text.length} 字符，已截断显示；完整内容已保存: ${saved}（可用 read 工具读取）]`;
      }
    }

    clearAttachments();
    onSubmit(text, imgs);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={ACCENT} bold>{promptLabel ?? SYM_USER} </Text>
        <TextInput
          key={inputEpoch}
          value={value}
          onChange={(v) => {
            setValue(collapsePaste(value, v) ?? v); // null = 非折叠场景，原样接收
            setCompIdx(-1);
          }}
          onSubmit={submit}
        />
      </Box>
      {matches.length > 0 ? (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text dimColor>
            命令 {selectedIdx + 1}/{matches.length} · ↑↓ 选择 · Tab 补全 · Enter 执行
          </Text>
          {windowStart > 0 ? <Text dimColor>  ↑ 更多</Text> : null}
          {visibleMatches.map((c, i) => {
            const realIdx = windowStart + i;
            const selected = realIdx === selectedIdx;
            return (
              <Box key={c}>
                <Box width={14}>
                  <Text color={selected ? ACCENT : undefined} bold={selected} dimColor={!selected}>
                    {selected ? '▶ ' : '  '}/{c}
                  </Text>
                </Box>
                <Text dimColor={!selected}>{COMMAND_DESCRIPTIONS[c]}</Text>
              </Box>
            );
          })}
          {windowStart + COMMAND_WINDOW < matches.length ? <Text dimColor>  ↓ 更多</Text> : null}
        </Box>
      ) : null}
      {feedback ? <Box marginLeft={2}><Text dimColor>{feedback}</Text></Box> : null}
    </Box>
  );
}
