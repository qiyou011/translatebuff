# 启动埋点浏览器验收（2026-09-15）

## 范围与产物

- 当前未提交埋点增量，基线 `9da494f`；代码复审无 Critical/Important/Minor 阻断项，定向12文件101测试通过。
- `node scripts/pack.mjs test` 成功，国内测试后端/渠道7100，版本1.4.0，上游1.46.6。未发布、未提交、未推送。
- 固定交付包：`.output/startup-browser-qa-20260915/translatebuff-1.4.0-test-chrome.zip`（约5.64MB）。
- SHA256：`02ee736fa2aec5eb190ea19bcc5310168e14a316bf449a73a17bf57e92ac6c91`。
- 浏览器：headed Google Chrome for Testing 151.0.7922.34，独立测试profile，无真实登录凭据；从ZIP解压加载，不使用开发服务器或修改业务函数。
- 请求地址：`https://datareport1sit.htjsq.com/api/data_report/v1/client/click_event`。HTTP 200证明接口响应，不等同于数据表入库或看板取数验收。

## 实测结果

| 场景               | 操作及证据                                                                                        | 结果                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 卸旧装新           | 独立profile加载已有1.3.0测试包，确认worker，Extensions.uninstall移除，再加载本次1.4.0             | install事件一次，HTTP200                                                                         |
| 安装字段           | 捕获真实请求体                                                                                    | app_start_up/lifecycle、AITRANS、client_type=10、client_version=1.4.0、数值渠道7100、有效UUID sn |
| 活跃同源与去重     | 实际fork消息触发活跃两次                                                                          | 仅第一次发送，SN与安装事件一致，HTTP200                                                          |
| 卸载重装           | 卸载新扩展，确认官网Cookie仍在，再安装同一ZIP                                                     | install再次发送，SN保持不变，HTTP200                                                             |
| 真页面翻译         | 本地英文fixture，设微软引擎/中文目标，点击实际悬浮窗翻译按钮                                      | 出现中文译文与wrapper，活跃请求HTTP200                                                           |
| 持久安装后的冷启动 | 扩展管理页“加载未打包”完成持久安装，关闭整个测试浏览器，再以同profile启动（无load-extension参数） | startup事件一次，HTTP200，SN与安装一致                                                           |
| 扩展更新           | 已持久安装的同一路径先加载旧包1.3.0，确认manifest；替换为1.4.0 ZIP文件并执行原生runtime.reload    | update事件一次，HTTP200，版本1.4.0且SN保留                                                       |
| 普通SW唤醒         | CDP停止实际运行的worker，再通过forkPing唤醒；收到pong，观察2秒                                    | 新增生命周期事件为0                                                                              |

真实页面截图：`.output/startup-browser-qa-20260915/translated.png`（原始截图，不是合成图）。

自动化限制记录：Extensions.loadUnpacked/命令行加载属于临时安装，每次进程重启会触发install，不可用它证明startup。因此冷启动改用管理页持久安装，最终已捕获真实startup。第二次页面翻译未再次上报是既有日去重生效，不算功能失败。

## 未完成与交接

- 用户日常Chrome存在 juntao / Marie (Work) 两个资料，均见旧TranslateBuff。操作时资料被切换，旧包移除确认框失效；未确认任何日常资料中的卸载成功。已询问目标资料，待用户选择后再卸旧装新，不能将独立profile验收当作日常浏览器已替换。
- 本轮只验证国内Chrome测试包、游客身份；海外edition、其他商店渠道、Firefox/Edge真机、登录态实机请求仍未验收（此前单测/构建不代替实机）。
- 后端入库/看板、产品埋点台账/钉钉同步与MUL-169隐私政策仍待确认；6.3保持未勾选，不上线。
- 测试启动的浏览器和本地fixture服务器均已关闭。临时profile保留于 `/tmp/translatebuff-startup-qa-sdGIXC/` 供排查，未操作用户Cookie或关闭日常浏览器。
