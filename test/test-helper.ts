import { TemplateServer } from "./template-server";
import { spawn } from 'child_process';

const { execSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");

export class TestDriver {
  public env: Record<string, string>
  public workingDirectory: string;

  constructor(public rootDir: string, addToEnv: Record<string, string> = {}) {
    this.env = Object.assign({ CI: 1 }, process.env, addToEnv);
  }

  private async exec(command: string, args: string[] = []): Promise<{stdout: string, stderr: string}> {
    try {
      return await new Promise((resolve, reject) => {
        const stdout = [], stderr = [];
        const process = spawn(command, args, { shell: true, stdio: 'pipe', env: this.env },);
        process.stdout.on('data', (data) => {
          stdout.push(data.toString());
        });
        process.stderr.on('data', (data) => {
          stderr.push(data.toString());
        });
        process.on('close', (code) => {
          if (code === 0) {
            resolve({
              stdout: stdout.join('\n'),
              stderr: stderr.join('\n'),
            });
          } else {
            const error = new Error(`spawned command ${command} with args ${args} failed with exit code ${code}`);
            (error as any).code = code;
            (error as any).stdout = stdout.join('\n');
            (error as any).stderr = stderr.join('\n');
            reject(error);
          }
        });
      });
    } catch (e) {
      console.log(e.stdout.toString())
      console.error(e.stderr.toString())
      throw e;
    }
  }

  switchToTempDir = () => {
    const pathName = path.join(os.tmpdir(), "test");
    this.workingDirectory = fs.mkdtempSync(pathName);
    process.chdir(this.workingDirectory);
  }

  copyFolders = (...folderNames) => {
    for (const folderName of folderNames) {
      fse.copySync(path.join(this.rootDir, folderName), folderName)
    }
  }

  copyFiles = (...fileNames) => {
    for (const fileName of fileNames) {
      fs.copyFileSync(path.join(this.rootDir, fileName), fileName);
    }
  }

  copyFile = (source, dest) => {
    fs.copyFileSync(path.join(this.rootDir, source), dest);
  }

  stackDirectory = (stackName: string) => {
    return path.join(this.workingDirectory, 'cdktf.out', 'stacks', stackName)
  }

  synthesizedStack = (stackName: string) => {
    return fs.readFileSync(path.join(this.stackDirectory(stackName), 'cdk.tf.json'), 'utf-8')
  }

  init = async (template: string) => {
    await this.exec(
      `cdktf init --template ${template} --project-name="typescript-test" --project-description="typescript test app" --local`
    );
  }

  get = async () => {
    await this.exec(`cdktf get`);
  }

  synth = async (flags?: string) => {
    return await this.exec(`cdktf synth ${flags ? flags : ''}`);
  }

  list = (flags?: string) => {
    return execSync(`cdktf list ${flags ? flags : ''}`, { env: this.env}).toString();
  }

  diff = (stackName?: string) => {
    return execSync(`cdktf diff ${stackName ? stackName : ''}`, { env: this.env }).toString();
  }

  deploy = (stackName?: string) => {
    return execSync(`cdktf deploy ${stackName ? stackName : ''} --auto-approve`, { env: this.env }).toString();
  }

  destroy = (stackName?: string) => {
    return execSync(`cdktf destroy ${stackName ? stackName : ''} --auto-approve`, { env: this.env }).toString();
  }

  setupTypescriptProject = async () => {
    this.switchToTempDir()
    await this.init('typescript')
    this.copyFiles('main.ts', 'cdktf.json')
    await this.get()
  }

  setupPythonProject = async () => {
    this.switchToTempDir()
    await this.init('python')
    this.copyFiles('main.py', 'cdktf.json')
    await this.get()
  }

  setupCsharpProject = async () => {
    this.switchToTempDir()
    await this.init('csharp')
    this.copyFiles('Main.cs', 'cdktf.json')
    await this.get()
    execSync('dotnet add reference .gen/aws/aws.csproj', { stdio: 'inherit', env: this.env });
  }

  setupJavaProject = async () => {
    this.switchToTempDir()
    await this.init('java')
    this.copyFiles('cdktf.json')
    this.copyFile('Main.java', 'src/main/java/com/mycompany/app/Main.java')
    await this.get()
  }

  setupRemoteTemplateProject = async (overrideUrl?: string) => {
    const templateServer = new TemplateServer(path.resolve(__dirname, '..', 'packages/cdktf-cli/templates/typescript'));
    try {
      const url = await templateServer.start();
      this.switchToTempDir()
      await this.init(overrideUrl || url)
      this.copyFiles('cdktf.json')
      await this.get()
    } finally {
      await templateServer.stop();
    }
  }
}



