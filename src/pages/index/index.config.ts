export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '配料表AI分析',
      navigationBarBackgroundColor: '#f0fdf4',
      navigationBarTextStyle: 'black'
    })
  : {
      navigationBarTitleText: '配料表AI分析',
      navigationBarBackgroundColor: '#f0fdf4',
      navigationBarTextStyle: 'black'
    }