// fork：隐藏上游「笔记库连接」区块。远程笔记库（note-sync）是上游 read-frog 功能，任译喵不提供。
// 经 wxt.config resolve 重定向顶替上游同名叶子组件 notebase-connection-field.tsx，渲染空。
// 上游调用点传入的 form prop 在此忽略（重定向为构建期行为，上游 index.tsx 的 TS 仍解析到真身、类型无碍）。
export function NotebaseConnectionField() {
  return null
}
