import ec2ssh from './index'

ec2ssh().then(
  () => {
    process.exit(0)
  },
  (error) => {
    // eslint-disable-next-line no-console
    console.error(error.message)
    if ('code' in error) process.exit(error.code)
    else if ('signal' in error) process.exit(signalCode(error.signal))
    else process.exit(1)
  }
)

function signalCode(signal: string) {
  switch (signal) {
    case 'SIGABRT':
      return 6
    case 'SIGHUP':
      return 1
    case 'SIGILL':
      return 4
    case 'SIGINT':
      return 2
    case 'SIGKILL':
      return 9
    case 'SIGPIPE':
      return 13
    case 'SIGQUIT':
      return 3
    case 'SIGSEGV':
      return 11
    case 'SIGTERM':
      return 15
    case 'SIGTRAP':
      return 5
  }
  return 0
}
