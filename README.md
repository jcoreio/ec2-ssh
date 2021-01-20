# @jcoreio/ec2-ssh

[![CircleCI](https://circleci.com/gh/jcoreio/ec2-ssh.svg?style=svg)](https://circleci.com/gh/jcoreio/ec2-ssh)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/%40jcoreio%2Fec2-ssh.svg)](https://badge.fury.io/js/%40jcoreio%2Fec2-ssh)

```
npm i -g @jcoreio/ec2-ssh
# Or
npx @jcoreio/ec2-ssh
```

Use at your own risk. Prompts you to select an EC2 instance, then SSHes into that instance, attempting to select the correct username automatically, and using the internal DNS hostname, and the identity file at `~/.ssh/<KeyName>.pem` if it exists, where `KeyName` is the property of the EC2 instance in the `aws-sdk` response.

If you're not storing your identity files in that manner, you can add the following to your `~/.ssh/config`:

```
Host *.compute.internal
  User ec2-user
  IdentityFile ~/.ssh/your-identity-file.pem
```

It will set the `AWS_SDK_LOAD_CONFIG` environment variable to load the default region from your `~/.aws/config`.
See https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-region.html for other ways
of setting the default region.

```
> ec2-ssh
? Select an EC2 Instance (region: us-west-2) ›
    i-00000000000000000 foo (recent)
    i-00000000000000001 bar
❯   i-00000000000000002 baz
    i-00000000000000003 qux
ssh -t -i ~/.ssh/identity.pem ubuntu@ip-192-168-0-1.us-west-2.compute.internal
Welcome to Ubuntu 18.04.1 LTS (GNU/Linux 4.15.0-1021-aws x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/advantage
...
```
