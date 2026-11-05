<template>
  <div class="invoice-wrapper">
    <iframe
      ref="iframeRef"
      src="/QuoteCustomer/index.html"
      frameborder="0"
      scrolling="auto"
      class="invoice-frame"
      @load="onIframeLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({ name: 'FinanceCustomerInvoiceView' })

const iframeRef = ref<HTMLIFrameElement>()
let resizeObserver: ResizeObserver | null = null

function adjustHeight() {
  const iframe = iframeRef.value
  if (!iframe) return
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      const height = Math.max(
        doc.documentElement.scrollHeight,
        doc.body.scrollHeight,
        doc.documentElement.offsetHeight,
        doc.body.offsetHeight
      )
      iframe.style.height = `${height}px`
    }
  } catch {
    iframe.style.height = '100vh'
  }
}

function onIframeLoad() {
  const iframe = iframeRef.value
  if (!iframe) return
  adjustHeight()

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    resizeObserver = new ResizeObserver(() => {
      adjustHeight()
    })
    resizeObserver.observe(doc.documentElement)
    resizeObserver.observe(doc.body)
  } catch {
    const poll = window.setInterval(() => {
      adjustHeight()
      if (!iframeRef.value) window.clearInterval(poll)
    }, 500)
    window.setTimeout(() => window.clearInterval(poll), 15000)
  }
}

function onMessage(e: MessageEvent) {
  if (e.data && typeof e.data === 'object' && e.data.__quoteCustomerHeight) {
    adjustHeight()
  }
}

onMounted(() => {
  window.addEventListener('resize', adjustHeight)
  window.addEventListener('message', onMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustHeight)
  window.removeEventListener('message', onMessage)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.invoice-wrapper {
  width: 100%;
  min-height: 100%;
}

.invoice-frame {
  width: 100%;
  border: 0;
  display: block;
}
</style>