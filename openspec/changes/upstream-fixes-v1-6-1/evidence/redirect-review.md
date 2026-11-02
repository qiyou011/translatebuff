# 重定向贡献对账

## P08

- `entrypoints/subtitles.content/universal-adapter.ts` 的新销毁、导航取消、监听释放和异步恢复保护由 `src/fork/upstream-services/video-adapter.ts` 的继承关系直接获得。fork包装只override AI/侧栏准入及云摘要/转录拒绝，未覆盖这些生命周期方法；resolve插件允许包装导入其原件，未形成自引用。无需复制适配器。
- `entrypoints/subtitles.content/renderer/mount-subtitles-sidebar.tsx` 的真实学习侧栏仍映射到无副作用的 `src/fork/upstream-services/subtitles-sidebar.ts`。新原件增加unmount导出，YouTube初始化器会调用；fork须补相同无副作用清理契约，不挂载UI/Provider/查询，也不读取adapter。
- 已完成上述贡献核对后仅更新两条原件指纹，以恢复真实fork测试。不是全表刷新，也不将P08源测试通过当作fork消费已通过。

## P12

universal-adapter新增的原生字幕等待/迟响应保护、广告状态及失败后受控重试均在基类，fork包装未覆盖相关私有方法，因此真实继承获得。AI转录与学习侧栏override保持拒绝/false，不修改禁用sidebar-item原件及其指纹。仅在该继承贡献核对后更新universal-adapter指纹。
