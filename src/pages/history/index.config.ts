export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分析历史'
    })
  : {
      navigationBarTitleText: '分析历史'
    }