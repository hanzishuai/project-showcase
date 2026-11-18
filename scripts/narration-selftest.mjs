import assert from 'node:assert/strict'
import { build } from '../frontend/node_modules/esbuild/lib/main.js'

const bundle = await build({
  entryPoints: ['frontend/src/agent/narration.ts'],
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{
    name: 'reactivity-mock',
    setup(builder) {
      builder.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'mock' }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
        contents: 'export const ref = value => ({value}); export const computed = get => ({get value(){return get()}})',
        loader: 'js'
      }))
    }
  }]
})
const { narration } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

const synthesized = []
const played = []
globalThis.fetch = async (url, options) => {
  options.signal.throwIfAborted()
  if (url.endsWith('/narration')) return Response.json({
    title: '讲解稿', source: 'script', sections: [
      { title: '开场', segments: ['第一句。', '第二句。'] },
      { title: '收尾', segments: ['第三句。'] }
    ]
  })
  synthesized.push(JSON.parse(options.body).text)
  return new Response(new Blob(['audio']))
}
globalThis.Audio = class {
  async play() { played.push(this) }
  pause() { this.paused = true }
  end() { this.onended() }
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.fail('播放器没有到达预期状态')
}

let chatBusy = true
narration.setChatBusy(() => chatBusy)
await narration.start('讲解稿', 'script')
assert.equal(played.length, 0, '助手的确认回复播放完才读正文')
chatBusy = false
await until(() => played.length === 1)
assert.deepEqual(synthesized, ['第一句。', '第二句。'], '只预取下一句')
played[0].end()
await until(() => played.length === 2)
narration.pause()
assert.equal(played[1].paused, true)
assert.equal(narration.status.value, 'paused')
assert.equal(narration.completed.value, 1)
assert.equal(narration.snapshot().excerpt, '第二句。')

const beforeResume = synthesized.length
narration.resume()
await until(() => played.length === 3)
assert.equal(synthesized[beforeResume], '第二句。', '从被打断的句子继续')
narration.seek('收尾')
await until(() => played.length === 4)
assert.equal(played[2].paused, true)
played[3].end()
await until(() => narration.status.value === 'finished')
assert.equal(narration.completed.value, 3)
narration.stop()
assert.equal(narration.snapshot(), null)
console.log('全文朗读顺序、预取、暂停、续读和跳节通过')
