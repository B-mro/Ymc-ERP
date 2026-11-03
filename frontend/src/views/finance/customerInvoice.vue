<template>
  <div class="invoice-wrapper">
    <iframe
      ref="iframeRef"
      src="/QuoteCustomer/index.html"
      frameborder="0"
      scrolling="no"
      class="invoice-frame"
      @load="adjustHeight"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({ name: 'FinanceCustomerInvoiceView' })

const iframeRef = ref<HTMLIFrameElement>()

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

onMounted(() => {
  window.addEventListener('resize', adjustHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustHeight)
})
</script>

<style scoped>
.invoice-wrapper {
  width: 100%;
  min-height: 100%;
  overflow: hidden;
}

.invoice-frame {
  width: 100%;
  border: 0;
  display: block;
}
</style>