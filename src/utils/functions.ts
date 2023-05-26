import { spawnSync } from 'child_process';
import { ParamsOf } from './types';
import prompts from 'prompts';

/**
 * controlledSpawn
 * @param params
 */
export const controlledSpawn = (...params: ParamsOf<typeof spawnSync>) => {
  params[2] && !params[2].encoding && (params[2].encoding = 'utf8');
  const output = spawnSync(...params);
  if (output.status !== 0) {
    console.log(output.error);
    console.log(output.stdout?.toString() ?? '');
    console.log(output);
    throw new Error(output.stderr.toString());
  }

  return output.stdout.toString();
};

/**
 * ask
 * @param questions
 * @param options
 */
export const ask = async <T extends string = string>(
  questions: ParamsOf<typeof prompts<T>>[0],
  options?: ParamsOf<typeof prompts>[1]
): Promise<prompts.Answers<T>> => {
  return prompts(questions, {
    ...options,
    onCancel: () => {
      process.exit(0);
    }
  });
};
