import {
  LambdaClient,
  ListFunctionsCommand,
  ListVersionsByFunctionCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda";
import chalk from "chalk";
import inquirer from "inquirer";

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
      let allFunctions = [];
      let marker = undefined;

      do {
        const command = new ListFunctionsCommand({
          Marker: marker,
          MaxItems: 50,
        });

        const response = await this.client.send(command);

        const functions = response.Functions.map((func) => ({
          name: func.FunctionName,
          arn: func.FunctionArn,
          runtime: func.Runtime,
          lastModified: func.LastModified,
        }));

        allFunctions = allFunctions.concat(functions);
        marker = response.NextMarker;

        // 진행 상황 표시
        console.log(
          chalk.gray(
            `📋 함수 목록 가져오는 중... ${allFunctions.length}개 발견`
          )
        );
      } while (marker);

      // 특정 함수 이름이 지정된 경우 필터링
      if (this.functionName) {
        allFunctions = allFunctions.filter(
          (func) =>
            func.name === this.functionName ||
            func.name.includes(this.functionName)
        );
      }

      return allFunctions;
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
    let processedCount = 0;
    let errorCount = 0;

    // 각 함수별로 정리 작업 수행
    for (const func of functions) {
      processedCount++;
      console.log(
        chalk.cyan(
          `\n🔍 [${processedCount}/${functions.length}] ${func.name} 분석 중...`
        )
      );

      try {
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
      } catch (error) {
        errorCount++;
        console.log(
          chalk.red(`  ❌ ${func.name} 처리 중 오류: ${error.message}`)
        );

        // 오류가 발생해도 계속 진행할지 확인
        if (!this.dryRun && !this.options.force) {
          const { continueProcessing } = await this.confirmContinue();
          if (!continueProcessing) {
            console.log(chalk.yellow(`\n⏹️  사용자에 의해 중단되었습니다.`));
            break;
          }
        }
      }
    }

    // 결과 요약
    console.log(chalk.bold.green(`\n🎉 정리 완료!`));
    console.log(
      chalk.green(`  처리된 함수: ${processedCount}/${functions.length}개`)
    );
    console.log(chalk.green(`  삭제된 버전: ${totalDeleted}개`));
    console.log(chalk.blue(`  보존된 버전: ${totalSaved}개`));

    if (errorCount > 0) {
      console.log(chalk.red(`  오류 발생: ${errorCount}개 함수`));
    }

    if (this.dryRun) {
      console.log(
        chalk.yellow(
          `\n⚠️  드라이 런 모드였습니다. 실제로는 삭제되지 않았습니다.`
        )
      );
    }
  }

  async confirmContinue() {
    const { continueProcessing } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continueProcessing",
        message: "오류가 발생했습니다. 계속 진행하시겠습니까?",
        default: true,
      },
    ]);

    return { continueProcessing };
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

            // AWS API 호출 제한을 고려한 지연
            await this.delay(100);
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
