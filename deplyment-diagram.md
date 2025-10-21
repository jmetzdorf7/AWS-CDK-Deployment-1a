# AWS CDK Deployment — Simple Flow Diagram (Multiple Repos)

This document shows a simple flow for how AWS CDK apps from multiple repositories get deployed to AWS. It covers local and CI paths, multiple repo sources (apps, shared constructs, infra), key commands, and the CloudFormation transition.

Notes:
- You can use separate pipelines per repo or a central pipeline that pulls artifacts from multiple repos.
- Ensure `cdk bootstrap` has been run for each target account/region before first deploy.
- Replace example repo names/URLs below with your actual repositories.

## Example repositories (replace with your actual repos)
- git@github.com:org/app-repo-frontend.git
- git@github.com:org/app-repo-backend.git
- git@github.com:org/cdk-shared-constructs.git
- git@github.com:jmetzdorf7/AWS-CDK-Deployment-1a.git

## Quick Steps (commands) — per repo
- git clone <repo>
- cd <repo>
- npm ci  (or pip/poetry if using Python)
- cdk bootstrap aws://ACCOUNT/REGION
- cdk synth
- cdk deploy

## Mermaid flowchart


flowchart TD
  subgraph DevFlow[Developer Flow]
    Dev[Developer edits CDK app\n(in app or shared repo)]
    CloneA[git clone repo A\n(app-repo-frontend)]
    CloneB[git clone repo B\n(app-repo-backend)]
    CloneS[git clone shared constructs\n(cdk-shared-constructs)]
    InstallA[npm ci / pip install\n(in repo A)]
    InstallB[npm ci / pip install\n(in repo B)]
    InstallS[npm ci / pip install\n(in shared repo)]
    Dev --> CloneA & CloneB & CloneS
    CloneA --> InstallA
    CloneB --> InstallB
    CloneS --> InstallS
  end

  subgraph LocalDeploy[Local Deploy]
    SynthA[cdk synth (repo A)\n(generate CFN template)]
    SynthB[cdk synth (repo B)]
    Bootstrap[cdk bootstrap\n(once per account/region)]
    DeployA[cdk deploy (repo A)]
    DeployB[cdk deploy (repo B)]
    InstallA --> SynthA --> DeployA
    InstallB --> SynthB --> DeployB
    InstallS -->|import constructs| SynthA
    InstallS -->|import constructs| SynthB
    Bootstrap --> DeployA
    Bootstrap --> DeployB
  end

  subgraph CI[CI / CD Pipeline]
    CIRepoA[CI Trigger: repo A\n(GitHub Actions / Pipeline)]
    CIRepoB[CI Trigger: repo B]
    CentralPipeline[Central CDK Pipeline or Orchestrator\n(optional: pulls multiple repos)]
    BuildA[build & synth (repo A)]
    BuildB[build & synth (repo B)]
    Artifacts[Artifact storage\n(S3 / ECR)]
    DeployCI[cdk deploy (CI role / OIDC)]
    CIRepoA --> BuildA --> Artifacts --> DeployCI
    CIRepoB --> BuildB --> Artifacts --> DeployCI
    CentralPipeline -->|pulls from multiple repos| Artifacts --> DeployCI
  end

  CFN[CloudFormation\nCreates / Updates resources]
  AWS[Actual AWS Resources\n(Lambda, S3, IAM, VPC, etc.)]
  Outputs[Stack Outputs / Events / Logs]
  Rollback[Rollback on failure\nCloudFormation handles rollback]

  DeployA --> CFN --> AWS --> Outputs
  DeployB --> CFN
  DeployCI --> CFN
  CFN --> Rollback
```

## ASCII diagram (simple)

Multiple repos (app A, app B, shared constructs)
  |
  v
clone each -> install deps -> (use shared constructs where needed)
  |
  v
cdk bootstrap (per-account/region, once)
  |
  v
cdk synth (produces CFN templates)
  |
  v
cdk deploy (manual local OR automated via CI)
  |
  v
CloudFormation -> Provision/Update AWS resources -> Outputs & logs
  |
  v
(success) or (rollback on failure)

## Environment & prerequisites (multi-repo notes)
- Node.js (or language runtime used by each CDK project)
- AWS CDK installed (global or per-repo devDependency)
- AWS credentials configured (AWS_PROFILE or env vars) or use OIDC in CI
- IAM permissions to deploy CloudFormation stacks and to create resources used by the stacks
- `cdk bootstrap` for each account/region targeted
- If using shared constructs repo, add it as a dependency (npm package, private registry, or git submodule)

## CI suggestions for multiple repos
- Option A — Per-repo pipelines: each repo has its own CI that builds, synthesizes, and deploys its stack.
  - Use GitHub Actions or pipeline per repo.
  - Use `cdk deploy --require-approval never` in automated pipelines.
- Option B — Central orchestrator: a central pipeline pulls artifacts from multiple repos (or uses cross-repo workflow triggers) and deploys stacks in the required order.
  - Useful when deployments must be coordinated (e.g., infra before apps).
- Security:
  - Use GitHub OIDC to avoid long-lived secrets.
  - Scope CI roles with least privilege to deploy only required stacks.
- Artifacts:
  - Store synthesized templates and build artifacts in S3/ECR so the central pipeline can consume them.

## Cross-account / cross-region notes
- Bootstrapping and trust roles are required for cross-account deployments.
- Consider CDK Pipelines (higher-level construct) to manage cross-account deployments safely.
