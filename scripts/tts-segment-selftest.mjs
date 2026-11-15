#!/usr/bin/env node
/**
 * TTS 切句自测：确保送去语音合成的是完整句子（有标点断句），
 * 而不是被 10/24 字上限切成半句或 2 字碎片。
 */
import { extractSpeakableSegments } from '../frontend/vendor/rag-avatar/rag-avatar.js'

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (ok || !detail ? '' : ' → ' + detail))
}

function segment(text) {
  const out = []
  let buffer = ''
  for (const ch of text) {
    buffer += ch
    const { segments, rest } = extractSpeakableSegments(buffer, { eagerFirst: out.length === 0 })
    buffer = rest
    for (const piece of segments) out.push(piece)
  }
  if (buffer.trim()) out.push(buffer.trim())
  return out
}

const HARD_END = /[。！？；!?;…]$/
const stripSpace = (text) => text.replace(/\s/g, '')

const cases = [
  {
    name: '短回答保持整句',
    text: '这个问题我从资料里没找到能直接操作的入口，你可以说得更具体一点。',
    expect: ['这个问题我从资料里没找到能直接操作的入口，你可以说得更具体一点。']
  },
  {
    name: '多句回答按句切分',
    text: '看板上的项目清单我这边还没读到，不好瞎报。资料里只提到产教融合服务平台一个，它在不在看板里我说不准。要不要切到数据总览看看统计？',
    expect: [
      '看板上的项目清单我这边还没读到，不好瞎报。',
      '资料里只提到产教融合服务平台一个，它在不在看板里我说不准。',
      '要不要切到数据总览看看统计？'
    ]
  },
  {
    name: '不会在词语中间切开',
    text: '看板上的项目清单我这边还没读到，暂时说不准有几个项目。',
    expect: ['看板上的项目清单我这边还没读到，暂时说不准有几个项目。']
  },
  {
    name: '长清单整句合成',
    text: '看板上现在有 9 个项目：实验室预约系统、科研成果管理平台、课程实践评价系统、校园活动服务中心、实习岗位匹配平台、毕业设计协作平台、教学资源共享库、竞赛项目孵化平台、学术讲座预约平台。',
    expect: ['看板上现在有 9 个项目：实验室预约系统、科研成果管理平台、课程实践评价系统、校园活动服务中心、实习岗位匹配平台、毕业设计协作平台、教学资源共享库、竞赛项目孵化平台、学术讲座预约平台。']
  },
  {
    name: '长句在标点处断开，不切碎',
    text: '它是学校和企业对接的平台：学校发布科技成果，企业提出技术需求，双方按领域互相查找，发布内容由管理员把关。目前还是演示版，没有正式上线，库里是虚拟数据，20 条科技成果、20 条企业需求、9 个技术领域、24 张演示图。',
    boundary: true
  },
  {
    name: '超长无标点文本兜底切分',
    text: '这是一段故意没有任何标点符号的特别长的文字用来测试兜底切分逻辑是否会把一百二十个字以上的内容拆开避免语音合成请求过长导致异常然后再多写一些内容让总长度超过一百二十个字并且继续补充一些文字确保它真的足够长可以触发兜底切分这里还需要继续加长才能超过一百二十个汉字所以再补充一段完全没有标点的文字内容直到长度足够',
    maxLength: 120
  }
]

for (const item of cases) {
  const segments = segment(item.text)
  if (item.expect) {
    const equal = JSON.stringify(segments) === JSON.stringify(item.expect)
    record(item.name, equal, JSON.stringify({ got: segments, expect: item.expect }))
    continue
  }
  if (item.boundary) {
    const allPunct = segments.every((piece) => /[。！？；!?;…，、：,:]$/.test(piece))
    const sameText = stripSpace(segments.join('')) === stripSpace(item.text)
    const notTiny = segments.every((piece) => piece.length >= 6)
    record(item.name, allPunct && sameText && notTiny, JSON.stringify(segments))
    continue
  }
  const joined = segments.join('')
  const ok =
    segments.length >= 2 &&
    segments.every((piece) => piece.length > 0 && piece.length <= item.maxLength) &&
    stripSpace(joined) === stripSpace(item.text)
  record(item.name, ok, JSON.stringify(segments.map((piece) => piece.length)))
}

// 通用约束：除最后一段外，每段都应以句末/分句标点结束；且不应出现 2 字碎片
const sample = '平台还没正式上线，现在挂的是演示版，数据都是虚拟的。项目 10 月 27 日开工，计划 11 月 13 日先做一场交付演示，主要功能已完成，还在边开发边修。'
const sampleSegments = segment(sample)
const tailOk = sampleSegments.slice(0, -1).every((piece) => HARD_END.test(piece))
const lengthOk = sampleSegments.every((piece) => piece.length >= 6)
record('每个段落都有完整断句', tailOk, JSON.stringify(sampleSegments))
record('没有 2 字碎片', lengthOk, JSON.stringify(sampleSegments.map((piece) => piece.length)))

const passed = results.filter((item) => item.ok).length
console.log('\n通过 ' + passed + ' / ' + results.length)
if (passed !== results.length) process.exit(1)