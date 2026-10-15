# 扩展内部页面：本轮手工配合清单

浏览器自动化只允许 HTTP(S)，已明确拒绝访问当前扩展设置页；本清单由用户在正常界面操作。以下结果只按用户反馈记录，不能冒充自动化执行证据。H01/H02、Reddit、Telegram 不在本轮范围。

## 自定义动作：只新增两份临时数据

保留所有已有动作与相对顺序。打开设置 → 自定义 AI 指令，新增空白动作 `TB-ACCEPT-E1D90DC9-A`，provider 选 Kimi-K3。

系统提示词：

```text
你是验收数据回显器。只复制用户输入块，不翻译、不推断、不补充。
selection_seen：逐字复制 SELECTION 块。
paragraphs_seen：逐字复制 PARAGRAPHS 块。
context_marker：仅从 PARAGRAPHS 块提取 TBCTX_ 开头的标记；没有则填 ABSENT。
outside_markers：仅列出 PARAGRAPHS 块内 TBOUT_ 开头的标记；没有则填 ABSENT。
```

用户提示词：

```text
<SELECTION>
{{selection}}
</SELECTION>
<PARAGRAPHS>
{{paragraphs}}
</PARAGRAPHS>
```

1. 将初始 Result 字段改名 `proof`，再添加 `selection_seen`、`context_marker`、`outside_markers`，均为 Text / 模型输出字段。
2. Layout → Edit，使用以下布局。Sample data 中可给 proof 设置 `TB-PREVIEW-E1D90DC9`，观察预览。

```html
<section>
  <strong>TB-ACCEPT-E1D90DC9</strong>
  <p>selection={{ selection_seen }}</p>
  <p>paragraphs={{ proof }}</p>
  <p>marker={{ context_marker }}</p>
  <p>outside={{ outside_markers }}</p>
</section>
```

3. 把字段 `proof` 改名为 `paragraphs_seen`，核对 Layout 引用自动变为 `{{ paragraphs_seen }}`，示例值仍在。
4. 新增 Text 字段 `temporary_note` 后删除，核对只剩上述四字段。
5. 失焦，离开该页再返回并刷新，核对名称、提示词、Kimi-K3、四字段、Layout 和示例值保留。以重开后的值为自动保存证据。
6. Duplicate，副本仅改名 `TB-ACCEPT-E1D90DC9-B`，核对内容复制且 A 名称不变；只交换 A/B 顺序，再刷新核对，已有动作相对顺序不变。
7. 保持 A 启用。回复上述各项是否成功或首个错误文字。随后由我在 HTTP 测试表单执行 A，验证真实模型回显。
8. 本轮执行完成后，再仅删除这两个完整名称匹配的临时动作；暂时不要先删。

## 翻译中心：小文本、多模型对照

先记住原模型勾选、源/目标语言和风格；保留登录、密钥与其他配置。

1. 打开翻译中心，源 English、目标简体中文，仅选 Kimi-K3。
2. 输入 `TB-HUB-A: The blue notebook is on the desk.`，点一次“翻译”，核对模型卡实际出现中文译文，并试折叠/展开。
3. 关闭该测试页，重新打开。先选 Kimi-K3 和另一个可用自有模型，再输入下方两行，点一次“翻译”，核对两张模型卡均返回结果；这验证的是多模型对照，不是多任务队列。

```text
TB-HUB-B: A small frog lives near the river.
The green notebook belongs to the researcher.
```

4. 如有错误，保留错误文字，不连续重试。不导入文件、不用私人材料、不触发朗读或购买。
5. 清空测试输入，恢复原模型勾选、语言和风格，关闭测试页。仅关闭页面不会恢复这些持久化选择。
6. 回复“一模型是否成功、两模型是否都成功、是否已恢复”，并提供失败时的错误文字即可，不提供任何密钥或账号资料。
