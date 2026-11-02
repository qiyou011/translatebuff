# 替代自动化验收

2026-11-02，用户明确要求换一种方式验证，结束浏览器连接配置排查。当前交付采用本地HTTP契约联调、fork重定向回归、产物指纹和工程门禁，不依赖用户日常Chrome。

| 验证                                                                   | 结果                                          | 证据                                           |
| ---------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| 实际会员客户端、后台编排、网关、AI SDK与合批队列的本机HTTP联调         | 5组通过，无未处理错误                         | alternative-http-acceptance.log                |
| 页面/站点、Google保护、选区、picker、字幕与导航                        | 122文件、1524项通过，1文件/4项外部API有意跳过 | alternative-core-tests.log                     |
| 实际fork会员/provider、禁用云服务、术语/队列、输入隐私、设置与账号菜单 | 81文件、676项通过                             | alternative-fork-tests.log                     |
| 四套既有构建所有记录文件及海外zip                                      | SHA256全部一致                                | alternative-artifact-check.json                |
| 类型检查                                                               | 退出码0                                       | alternative-type-check.log                     |
| 格式检查与冻结基准boundary                                             | 结果见最终日志                                | alternative-fmt.log / alternative-boundary.log |

本轮共2205项通过；不与前轮完整套件重复相加。前轮完整根5184项、fork1025项及国内三浏览器/海外包构建记录仍有效，业务源码与产物未改变。所有测试均设置SKIP_FREE_API=true。

## 五组真实HTTP联调

1. 假凭据经实际会员客户端建立会话，派生PRO/额度，注入动态baseURL与模型；读取存储中的实际provider，由真实AI SDK将两条翻译合批为一请求，核对鉴权头和解码结果；最后清除会话、会员信息和provider key。
2. 先建立会话，再由HTTP端点返回401，确认会话、会员信息与key清空。
3. 挂起tokens的HTTP响应，在此期间登出，再返回迟到响应，确认不会恢复登录或继续请求模型。
4. 同一原文使用术语编辑/删除的不同revision，确认发出两个独立HTTP请求，中文术语只进入编辑版本，结果不串用。
5. 本机模型端点首次漏掉一条结果，确认真实队列只重发缺失条目，不重发已成功条目。

没有mock会员API、后台编排、provider工厂、AI SDK、请求队列或协议解码。使用WXT fakeBrowser隔离扩展存储，仅替换请求统计落库。服务只监听127.0.0.1随机端口，fetch边界拒绝其他origin，每个场景收尾检查零外发请求。全部账号、key、模型和额度均为fixture，未读取用户Chrome凭据。

共享vitest.setup.ts中的jsdom TextEncoder兼容实现不适合中文HTTP。脚本仅在自身作用域恢复Node原生编码器，并把SDK生成的JSON按UTF-8转为字节交给原生fetch，避免已缓存兼容编码器造成Content-Length不一致；未改JSON协议、全局测试配置或业务代码。适配后5项全绿、无未处理错误。

独立配置复用vitest.fork.config.ts的真实重定向插件，复跑命令：

```powershell
$env:SKIP_FREE_API='true'
pnpm run test --config openspec/changes/upstream-fixes-v1-6-1/evidence/alternative-acceptance.config.ts
```

## 结论边界

替代自动化已完成，支持审阅本轮代码移植与客户端回归。它不证明真实账号权益、线上额度/模型可用性、网站DOM或YouTube字幕现状，也不证明所有线上场景均零上游请求。原tasks.md第8.1至8.4涉及的真实观察保持未勾选，不用模拟补签，不宣称生产发布验收已完成。

本轮只增加验收文件与记录，并修正存档browser-harness.cjs的无行为变化lint问题；未重新控制用户Chrome或修改业务源码。没有commit、push、发布或归档。
