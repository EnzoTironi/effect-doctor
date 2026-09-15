# Effect Doctor

[![ci](https://img.shields.io/github/actions/workflow/status/EnzoTironi/effect-doctor/ci.yml?style=flat&colorA=000000&colorB=000000)](https://github.com/EnzoTironi/effect-doctor/actions)
[![npm](https://img.shields.io/npm/v/effect-ts-doctor?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/effect-ts-doctor)
[![license](https://img.shields.io/badge/license-Modified%20MIT-black)](./LICENSE)

**Your agent writes bad Effect. This catches it.**

CLI que audita um codebase **Effect-TS** no **RC mais recente** (`effect@4.0.0-rc.115`, `npm install effect@rc`). Analog de produto do [react-doctor](https://github.com/millionco/react-doctor): scan determinístico, diagnósticos com arquivo/linha, pontuação 0–100, receita **ruim → bom** em cada regra.

Repositório: [github.com/EnzoTironi/effect-doctor](https://github.com/EnzoTironi/effect-doctor).

O pacote no npm é **`effect-ts-doctor`**. O nome `effect-doctor` já está publicado por outro autor ([JGalbss/effect-doctor](https://github.com/JGalbss/effect-doctor)). Os ids das regras continuam `effect-doctor/<regra>`.
