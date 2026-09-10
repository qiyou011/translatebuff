## REMOVED Requirements

### Requirement: v1 保留 better-auth

**Reason**：任译喵已有独立登录会员体系，不使用上游 Identity/RPC 云服务，不再要求自有后端兼容上游 better-auth。

**Migration**：保留上游原客户端源码与环境配置，通过构建重定向接入 fork 禁用适配器；不迁移或删除用户数据，不改变任译喵认证链路。由下述“上游认证客户端本地禁用适配”要求取代。

## ADDED Requirements

### Requirement: 上游认证客户端本地禁用适配

系统 SHALL 在 fork 构建中替换上游界面和后台认证客户端的运行时实现，保留消费方需要的导出和会话契约。会话读取 SHALL 返回无会话、非加载状态，不注册真实会话刷新或产生网络请求；非读取认证操作 SHALL 明确报告不支持。上游源码与依赖可继续同步，但不得成为禁用时的回退实现。

#### Scenario: 上游会话不发请求

- **WHEN** UI 调用 useSession，或界面/后台调用 getSession
- **THEN** 返回符合消费契约的无会话结果，不保持 pending、不联网、不启动刷新订阅

#### Scenario: 上游认证操作与自有认证分离

- **WHEN** 旧入口尝试调用上游认证操作，或者任译喵用户已处于登录状态
- **THEN** 上游认证操作被本地拒绝而非伪装成功，自有会话、会员 token 和官网认证联动不受影响
