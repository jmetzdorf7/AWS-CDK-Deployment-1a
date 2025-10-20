# AWS-CDK-Deployment-1a

A collection of AWS Cloud Development Kit (CDK) infrastructure-as-code artifacts and deployment instructions for the AWS-CDK-Deployment-1a repository.

This repository contains an AWS CDK project that defines, synthesizes, and deploys cloud infrastructure on AWS. The README below covers prerequisites, setup, deployment, teardown, common commands, and troubleshooting tips so you can get infrastructure deployed reliably.

---

## Table of contents

- Project overview
- Architecture
- Prerequisites
- Getting started
  - Clone
  - Configure AWS credentials
  - Bootstrap (if required)
  - Install dependencies
  - Build / synth
- Deploying
- Destroying the stack(s)
- Common commands
- Project structure
- Troubleshooting
- Security & best practices
- Contributing
- License
- Contact

---

## Project overview

This repository holds the CDK app and stacks used to create and manage AWS resources. It is intended to be used by developers and operators to:

- Keep AWS infrastructure under version control
- Reproduce environments easily
- Deploy changes via CDK/CloudFormation
- Track infrastructure changes as code

If you are reviewing or using this repository for the first time, follow the Getting started steps below.

---

## Architecture

(Replace or expand this section with the actual architecture information for your repo.)

- CDK App (one or more stacks)
- Stacks may create: VPCs, ECS/EKS resources, Lambda functions, S3 buckets, IAM roles/policies, CloudWatch alarms, etc.
- The CDK synthesizes CloudFormation templates which are deployed to AWS.

Add an architecture diagram or list of major stacks/resources in this section if available.

---

## Prerequisites

- AWS account and permissions to create CloudFormation stacks, IAM roles, and the resources defined in the stacks.
- AWS CLI installed and configured with an AWS profile:
  - aws configure --profile <your-profile>
- Node.js (>= 16 recommended) if using CDK in TypeScript/JavaScript.
- AWS CDK v2 CLI installed:
  - npm install -g aws-cdk@2
- If this project uses Python, install Python 3.8+ and the required virtualenv tooling and dependencies.
- Git.

Environment variables commonly used:
- AWS_PROFILE — the named AWS CLI profile to use
- AWS_REGION or CDK_DEFAULT_REGION — target AWS region
- CDK_DEFAULT_ACCOUNT — target AWS account (automatically set by CDK when synth/deploying with a profile)

---

## Getting started

1. Clone the repository
   - git clone https://github.com/jmetzdorf7/AWS-CDK-Deployment-1a.git
   - cd AWS-CDK-Deployment-1a

2. Configure your AWS credentials (example using a named profile):
   - aws configure --profile my-profile
   - Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment (less recommended).

3. Bootstrap your environment (only required the first time for an account/region):
   - cdk bootstrap aws://ACCOUNT_ID/REGION --profile my-profile
   - or
   - CDK_DEFAULT_ACCOUNT=ACCOUNT_ID CDK_DEFAULT_REGION=REGION cdk bootstrap --profile my-profile

4. Install dependencies and build

If the project uses TypeScript / JavaScript:
   - npm install
   - npm run build
   - cdk synth

If the project uses Python:
   - python -m venv .venv
   - source .venv/bin/activate
   - pip install -r requirements.txt
   - cdk synth

Note: Replace the commands above with those matching the project language and package manager in this repository.

---

## Deploying

You can deploy individual stacks or all stacks in the app.

- Deploy a single stack:
  - cdk deploy MyStackName --profile my-profile
- Deploy all stacks (if you want to deploy everything):
  - cdk deploy --all --profile my-profile

Recommended flags for CI or unattended deployments:
- --require-approval never (skip manual approval for security/higher-impact changes — use with caution)
Example:
- cdk deploy MyStackName --require-approval never --profile my-profile

After successful deployment the CDK will output any configured CloudFormation outputs (endpoints, ARNs, etc).

---

## Destroying / tearing down

To remove a deployed stack and its resources:

- cdk destroy MyStackName --profile my-profile
- Or destroy everything:
  - cdk destroy --all --profile my-profile

WARNING: Destroy will attempt to delete resources created by CDK. Some resources (S3 buckets with objects, RDS snapshots, etc.) may block deletion or cause data loss. Double-check before destroying production resources.

---

## Common commands

- cdk init                              # initialize a new cdk project (not needed for this repo)
- npm install                           # install npm dependencies (TypeScript/JS projects)
- npm run build                         # compile TypeScript (if applicable)
- cdk synth                             # synthesize CloudFormation templates
- cdk diff                              # show differences between deployed stack and local
- cdk deploy [StackName]                # deploy stack
- cdk destroy [StackName]               # delete stack
- cdk bootstrap aws://ACCOUNT/REGION    # provision CDK toolkit resources in account/region

Set AWS profile for a single command:
- AWS_PROFILE=my-profile cdk deploy MyStackName

---

## Project structure

(Adjust to the actual layout used in your repo.)

- cdk.json                — CDK app configuration
- package.json            — npm configuration (if TypeScript/JS)
- tsconfig.json           — TypeScript config (if TypeScript)
- bin/                    — CDK app entrypoint(s)
- lib/                    — CDK stack definitions
- src/                    — source code (if separate)
- README.md               — this file
- scripts/                — helper scripts (optional)
- tests/                  — unit / integration tests

---

## Troubleshooting

- "AccessDenied" or permission errors:
  - Ensure your AWS credentials have IAM permissions to create CloudFormation stacks and the resources defined.
- "Bucket already exists" errors (S3):
  - S3 bucket names are global — choose unique names or parameterize bucket names by account/region.
- CDK version mismatches:
  - Ensure your global CDK CLI major version matches the CDK libraries used in the project (CDK v2 apps should use CDK v2 CLI).
- Synth or build failures:
  - Confirm the project language toolchain is installed (Node, pip, etc.) and dependencies are installed.

Use cdk diff to preview changes before applying them.

---

## Security & best practices

- Do not commit AWS credentials or secrets into the repository.
- Use least-privilege IAM roles for CI/CD (create only required permissions).
- Parameterize sensitive values through SSM Parameter Store, Secrets Manager, or context/parameters passed at deploy-time.
- Review CloudFormation changes in code and via cdk diff before deploying.
- Consider using guardrails (AWS Config, Service Control Policies) for production accounts.

---

## Contributing

If you want to contribute:

1. Fork the repository.
2. Create a branch for your feature or fix: git checkout -b feature/description
3. Make changes and add tests if applicable.
4. Open a pull request describing your changes.

Follow repository-specific contribution guidelines if they exist.

---

## CI/CD (GitHub Actions)

This repository includes two example GitHub Actions workflows you can use as a starting point:

- .github/workflows/cdk-ci.yml — runs on pull requests (and pushes to main/develop) to install dependencies, build (if applicable), run cdk synth and cdk diff. Good for catching infra changes during code review.
- .github/workflows/cdk-deploy.yml — runs on push to main to perform an automated deploy using the AWS CDK.

Both workflows are written to support two authentication approaches:
1. Recommended: GitHub OIDC and an IAM role that GitHub Actions can assume.
   - Create an IAM role with a trust policy allowing the GitHub Actions OIDC provider (accounts: "https://token.actions.githubusercontent.com") and restrict by repository/branch.
   - Add the role ARN to repository secrets as AWS_ROLE_TO_ASSUME.
   - The workflows use aws-actions/configure-aws-credentials with role-to-assume.

2. Fallback: static AWS credentials (less secure)
   - Create repository secrets AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY with a dedicated low-privilege user.
   - Use this only if OIDC cannot be configured.

Recommended permissions for the role/user:
- CloudFormation (Create/Update/Delete stacks)
- The AWS services your stacks manage (S3, IAM, Lambda, ECS, ECR, EKS, RDS, etc.)
- Use least-privilege and separate roles for CI vs production where possible.

How to enable OIDC for GitHub Actions:
1. In the AWS console, create an IAM role with a trust relationship for GitHub's OIDC provider (actions.githubusercontent.com).
2. Limit the trust policy to your repository and branch.
3. Attach a policy that grants the minimal required permissions for CDK deploy.
4. Save the role ARN into the repository secret AWS_ROLE_TO_ASSUME.

Notes and tips:
- For PR checks, the CI workflow runs cdk diff. By default the step is permissive (doesn't fail the job if differences are detected); adjust behavior to your team's preferred gating strategy.
- For deployments, the example uses --require-approval never for unattended deploys. Remove or adjust that flag if you require manual approval for security-sensitive changes.
- You may want to gate deploys with branch protection, environment approvals, or manual workflow_dispatch triggers for production.
- If your project uses Python CDK, replace Node steps (npm ci / npm run build) with Python virtualenv and pip install -r requirements.txt.

If you want, I can:
- Create these workflows in the repository for you (open a PR) — tell me if you'd like me to do that and whether you prefer OIDC or static credentials for bootstrap instructions.
- Add a step to publish CDK assets to ECR or a step that runs integration tests after deploy.
```
