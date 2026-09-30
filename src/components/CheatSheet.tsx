export function CheatSheet() {
  return (
    <details className="cheatsheet">
      <summary>规则速查</summary>
      <table>
        <thead>
          <tr>
            <th>规则</th>
            <th>引用</th>
            <th>要求</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>前提</td><td>无</td><td>仅顶层，题目给定</td></tr>
          <tr><td>假设</td><td>无</td><td>分支第一行</td></tr>
          <tr><td>重申</td><td>1 行</td><td>公式与可见的引用行完全相同</td></tr>
          <tr><td>∧I 合取引入</td><td>2 行</td><td>结论为两引用行的合取 A ∧ B</td></tr>
          <tr><td>∧E 合取消去</td><td>1 行</td><td>引用行为合取式，结论为其某一合取支</td></tr>
          <tr><td>∨I 析取引入</td><td>1 行</td><td>结论为析取式，某一析取支等于引用行</td></tr>
          <tr><td>∨E 析取消去</td><td>1 行 + 2 分支</td><td>引用可见析取式 A ∨ B；两个已关闭直接子分支分别以 A、B 为假设，末行均为本行结论</td></tr>
          <tr><td>→I 蕴含引入</td><td>1 分支</td><td>已关闭直接子分支：首行假设为前件，末行结论为后件</td></tr>
          <tr><td>→E 蕴含消去</td><td>2 行</td><td>引用 A → B 与 A，结论为 B</td></tr>
        </tbody>
      </table>
      <p>
        引用只能指向先前可见的行；已关闭分支内部的行不能被外部引用。公式按语法树比较，
        逻辑等价不算相同。优先级：∧ &gt; ∨ &gt; →，→ 右结合，其余左结合。
      </p>
    </details>
  );
}

