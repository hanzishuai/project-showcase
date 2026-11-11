import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useFitScreen() {
  const screen = ref<HTMLDivElement | null>(null)

  function fitScreen() {
    const el = screen.value
    if (!el) return
    if (window.matchMedia('(max-width: 1100px)').matches) {
      el.style.transform = ''
      return
    }
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
    el.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(4) + ')'
  }

  onMounted(() => {
    fitScreen()
    window.addEventListener('resize', fitScreen)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', fitScreen))

  return { screen, fitScreen }
}
