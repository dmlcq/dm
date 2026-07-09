export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/history/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '配料表AI分析',
    navigationBarTextStyle: 'black'
  },
  // 添加权限配置
  permission: {
    'scope.camera': {
      desc: '用于拍摄食品配料表图片'
    }
  }
})
