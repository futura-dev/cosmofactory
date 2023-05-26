#! /usr/bin/env node
import { program } from 'commander';
import { init } from './commands/init';
import * as process from 'process';
import { build } from './commands/build';

// program definition
program.name('@futura-dev/cosmofactory').description('Cosmofactory 📦');

// 'init' command definition
program.command('init').action(async () => init());

// 'build' command definition
program.command('build').action(async () => build());

// parse program
program.parse(process.argv);
