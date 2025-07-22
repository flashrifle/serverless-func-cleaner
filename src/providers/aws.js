import {
  LambdaClient,
  ListFunctionsCommand,
  ListVersionsByFunctionCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import chalk from "chalk";

export class AWSCleaner {
  constructor(options) {
    this.options = options;
    this.region = options.region || process.env.AWS_REGION || "ap-northeast-2";
    this.dryRun = options.dryRun;
    this.functionName = options.functionName;

    this.client = new LambdaClient({ region: this.region });
  }

  async listFunctions() {
    try {
      const command = new ListFunctionsCommand({});
      const response = await this.client.send(command);

      let functions = response.Functions.map((func) => ({
        name: func.FunctionName,
        arn: func.FunctionArn,
        runtime: func.Runtime,
        lastModified: func.LastModified,
      }));

      // 특정 함수 이름이 지정된 경우 필터링
      if (this.functionName) {
        functions = functions.filter(
          (func) =>
            func.name === this.functionName ||
            func.name.includes(this.functionName)
        );
      }

      return functions;
    } catch (error) {
      throw new Error(
        `AWS Lambda 함수 목록을 가져오는데 실패했습니다: ${error.message}`
      );
    }
  }

  async cleanup() {
    const functions = await this.listFunctions();

    if (functions.length === 0) {
      console.log(chalk.yellow("정리할 함수가 없습니다."));
      return;
    }

    console.log(chalk.blue(`\n📋 정리 대상: ${functions.length}개 함수`));

    let totalDeleted = 0;
    let totalSaved = 0;

    // 각 함수별로 정리 작업 수행
    for (const func of functions) {
      console.log(chalk.cyan(`\n🔍 ${func.name} 분석 중...`));

      const result = await this.cleanupFunction(func);

      if (result.deleted > 0) {
        console.log(chalk.green(`  ✅ ${result.deleted}개 버전 삭제됨`));
        totalDeleted += result.deleted;
      } else {
        console.log(chalk.yellow(`  ℹ️  삭제할 버전이 없음`));
      }

      if (result.saved > 0) {
        console.log(chalk.blue(`  💾 ${result.saved}개 버전 보존됨`));
        totalSaved += result.saved;
      }
    }

    // 결과 요약
    console.log(chalk.bold.green(`\n🎉 정리 완료!`));
    console.log(chalk.green(`  삭제된 버전: ${totalDeleted}개`));
    console.log(chalk.blue(`  보존된 버전: ${totalSaved}개`));

    if (this.dryRun) {
      console.log(
        chalk.yellow(
          `\n⚠️  드라이 런 모드였습니다. 실제로는 삭제되지 않았습니다.`
        )
      );
    }
  }

  async cleanupFunction(func) {
    try {
      // 함수의 모든 버전 가져오기
      const versionsCommand = new ListVersionsByFunctionCommand({
        FunctionName: func.name,
      });
      const versionsResponse = await this.client.send(versionsCommand);

      const versions = versionsResponse.Versions || [];

      // $LATEST 버전 제외하고 실제 버전만 필터링
      const numberedVersions = versions.filter((v) => v.Version !== "$LATEST");

      if (numberedVersions.length <= 1) {
        return { deleted: 0, saved: numberedVersions.length };
      }

      // 버전을 번호순으로 정렬 (최신 버전이 마지막)
      numberedVersions.sort(
        (a, b) => parseInt(a.Version) - parseInt(b.Version)
      );

      // 최신 버전을 제외한 모든 버전 삭제
      const versionsToDelete = numberedVersions.slice(0, -1);
      const latestVersion = numberedVersions[numberedVersions.length - 1];

      console.log(chalk.gray(`    총 ${numberedVersions.length}개 버전 발견`));
      console.log(
        chalk.gray(
          `    최신 버전: ${latestVersion.Version} (${latestVersion.LastModified})`
        )
      );
      console.log(chalk.gray(`    삭제할 버전: ${versionsToDelete.length}개`));

      let deletedCount = 0;

      for (const version of versionsToDelete) {
        if (this.dryRun) {
          console.log(
            chalk.yellow(`    [DRY RUN] 버전 ${version.Version} 삭제 예정`)
          );
        } else {
          try {
            const deleteCommand = new DeleteFunctionCommand({
              FunctionName: func.name,
              Qualifier: version.Version,
            });
            await this.client.send(deleteCommand);
            console.log(chalk.green(`    ✅ 버전 ${version.Version} 삭제됨`));
            deletedCount++;
          } catch (error) {
            console.log(
              chalk.red(
                `    ❌ 버전 ${version.Version} 삭제 실패: ${error.message}`
              )
            );
          }
        }
      }

      return {
        deleted: deletedCount,
        saved: 1, // 최신 버전 1개만 보존
      };
    } catch (error) {
      throw new Error(`함수 ${func.name} 정리 중 오류 발생: ${error.message}`);
    }
  }
}
