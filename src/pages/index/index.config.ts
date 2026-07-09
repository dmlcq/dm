export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '配料表健康分析',
      navigationBarBackgroundColor: '#f0fdf4',
      navigationBarTextStyle: 'black'
    })
  : {
      navigationBarTitleText: '配料表健康分析',
      navigationBarBackgroundColor: '#f0fdf4',
      navigationBarTextStyle: 'black'
    }