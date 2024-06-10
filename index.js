#!/usr/bin/env node

'use strict'

if (process.env.AWS_SDK_LOAD_CONFIG == null)
  process.env.AWS_SDK_LOAD_CONFIG = '1'

const { EC2Client, DescribeImagesCommand } = require('@aws-sdk/client-ec2')
const {
  SSMClient,
  DescribeInstanceInformationCommand,
} = require('@aws-sdk/client-ssm')
const { selectEC2Instance } = require('@jcoreio/aws-select-cli-prompts')
const { spawn } = require('child_process')
const os = require('os')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

async function getAmiName(ec2, ImageId) {
  const { Images } = await ec2.send(
    new DescribeImagesCommand({ ImageIds: [ImageId] })
  )
  const name = Images && Images[0] && Images[0].Name
  if (!name) throw new Error(`failed to get name for image: ${ImageId}`)
  return name
}
function getUser(ami) {
  if (/ubuntu|nanostack/i.test(ami)) return 'ubuntu'
  if (/debian/i.test(ami)) return 'admin'
  if (/fedora/i.test(ami)) return 'fedora'
  if (/centos/i.test(ami)) return 'centos'
  if (/bitnami/i.test(ami)) return 'bitnami'
  if (/turnkey|omni/i.test(ami)) return 'root'
  return 'ec2-user'
}

function signalCode(signal) {
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

async function ec2ssh({ ec2 = new EC2Client(), ssm = new SSMClient() } = {}) {
  const instance = await selectEC2Instance({
    ec2,
    Filters: [
      {
        Name: 'instance-state-name',
        Values: ['pending', 'running'],
      },
    ],
  })

  const {
    InstanceId,
    ImageId,
    KeyName,
    PrivateDnsName,
    PublicDnsName,
  } = instance
  let host = PrivateDnsName || PublicDnsName
  if (!host)
    throw new Error(`instance doesn't have a PrivateDnsName or PublicDnsName`)

  let user = ImageId ? getUser(await getAmiName(ec2, ImageId)) : null

  if (InstanceId) {
    const {
      InstanceInformationList: [{ PlatformName } = {}] = [],
    } = await ssm.send(
      new DescribeInstanceInformationCommand({
        Filters: [{ Key: 'InstanceIds', Values: [InstanceId] }],
      })
    )
    if (PlatformName) {
      const userFromPlatform = getUser(PlatformName)
      if (userFromPlatform !== 'ec2-user') user = userFromPlatform
    }
  }

  if (user) host = `${user}@${host}`

  const args = ['-t']
  if (KeyName) {
    const identityFile = path.join(os.homedir(), '.ssh', `${KeyName}.pem`)
    try {
      await promisify(fs.stat)(identityFile)
      args.push('-i', identityFile)
    } catch (error) {
      // ignore
    }
  }

  args.push(host, ...process.argv.slice(2))

  // eslint-disable-next-line no-console
  console.log('ssh', ...args)

  const child = spawn('ssh', args, { stdio: 'inherit' })

  return await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      resolve({ code, signal })
      if (typeof code === 'number') process.exit(code)
      process.exit(signalCode(signal) + 127)
    })
  })
}

if (require.main === module) {
  ec2ssh().then(
    ({ code, signal }) => {
      if (typeof code === 'number') process.exit(code)
      process.exit(signalCode(signal) + 127)
    },
    error => {
      // eslint-disable-next-line no-console
      console.error(error.message)
      process.exit(1)
    }
  )
}
