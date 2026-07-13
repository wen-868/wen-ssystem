process.on('unhandledRejection', (reason, promise) => {
  console.error('=== Unhandled Rejection ===');
  console.error('Reason:', typeof reason === 'object' ? JSON.stringify(reason, null, 2) : reason);
  console.error('Stack:', reason && reason.stack ? reason.stack : 'No stack');
  console.error('=== End Unhandled Rejection ===');
  process.exit(1);
});

const { spawn } = require('child_process');
const taro = spawn('node', ['./node_modules/@tarojs/cli/bin/taro', 'build', '--type', 'weapp'], {
  stdio: 'inherit'
});

taro.on('close', (code) => {
  process.exit(code);
});
