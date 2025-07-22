#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import dotenv from "dotenv";
import { AWSCleaner } from "./providers/aws.js";
import { confirmAction } from "./utils/prompts.js";

// 환경 변수 로드
dotenv.config();

const program = new Command();

program
  .name("lambda-cleaner")
  .description(
    "AWS Lambda 함수의 최신 버전만 남기고 이전 버전들을 삭제하는 도구"
  )
  .version("1.0.0");

program
  .option("-d, --dry-run", "실제 삭제하지 않고 확인만", false)
  .option("-f, --function-name <name>", "특정 함수 이름 지정")
  .option("--force", "확인 없이 강제 삭제", false)
  .option("--region <region>", "AWS 지역 지정", "ap-northeast-2");

program.parse();

const options = program.opts();

async function main() {
  console.log(chalk.blue.bold("🚀 AWS Lambda Function Cleaner"));
  console.log(chalk.gray("AWS Lambda 함수의 이전 버전을 정리합니다.\n"));

  try {
    const cleaner = new AWSCleaner(options);

    // 드라이 런이 아닌 경우 확인
    if (!options.dryRun && !options.force) {
      const confirmed = await confirmAction(
        "⚠️  이 작업은 Lambda 함수의 이전 버전을 영구적으로 삭제합니다. 계속하시겠습니까?"
      );

      if (!confirmed) {
        console.log(chalk.yellow("작업이 취소되었습니다."));
        process.exit(0);
      }
    }

    // 정리 작업 실행
    await cleaner.cleanup();
  } catch (error) {
    console.error(chalk.red("❌ 오류가 발생했습니다:"), error.message);
    process.exit(1);
  }
}

main();
