#!/usr./bin/env node
if (process.env.AWS_SDK_LOAD_CONFIG == null)
  process.env.AWS_SDK_LOAD_CONFIG = '1'
import { ec2ssh } from './index'

ec2ssh({
  args: process.argv.slice(2),
  pseudoTTY: true,
  options: { stdio: 'inherit' },
  logCommand: true,
}).then(
  () => {
    process.exit(0)
  },
  (error: unknown) => {
    if (error instanceof Object) {
      // eslint-disable-next-line no-console
      if ('message' in error) console.error(error.message)
      if ('code' in error && typeof error.code === 'number')
        process.exit(error.code)
      else if ('signal' in error && typeof error.signal === 'string')
        process.exit(signalCode(error.signal))
    } else process.exit(1)
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
