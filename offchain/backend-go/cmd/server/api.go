// Package main — Swagger/OpenAPI 2.0 specification for the VNDC Backend API.
//
// This file contains ONLY the top-level @host / @BasePath / @securityDefinitions
// annotations that swag reads to generate the root swagger.json.
// All endpoint annotations live alongside their handler functions.

// @title          VNDC Backend API
// @version        1.0.0
// @description    Off-chain backend for the VNDC token platform.
// @description
// @description    ## Authentication
// @description    The API uses **wallet-based authentication** (Sign-In With Ethereum / EIP-191).
// @description    All protected endpoints require an `Authorization: Bearer <access_token>` header.
// @description
// @description    ### Login flow
// @description    1. `GET /v1/auth/challenge?wallet=0x…`  — obtain a nonce-embedded message
// @description    2. Sign the message with your wallet (personal_sign / EIP-191)
// @description    3. `POST /v1/auth/login` — submit the signature; receive a JWT pair
// @description    4. *(if 2FA is enabled)* `POST /v1/auth/2fa/complete` — verify TOTP code
// @description    5. Pass the `access_token` as `Authorization: Bearer <token>` on every request
// @description    6. `POST /v1/auth/refresh` — rotate tokens before access token expires (15 min)
// @description
// @description    ## Amount encoding
// @description    All token amounts are expressed in **wei** as **decimal strings** — never floats.
// @description    Example: `"1000000000000000000"` = 1 VNDC (18 decimals).

// @contact.name   VNDC Platform Team
// @contact.email  dev@vndc.io

// @license.name   Proprietary
// @license.url    https://vndc.io/terms

// @host      localhost:8080
// @BasePath  /v1

// @securityDefinitions.apikey  BearerAuth
// @in                          header
// @name                        Authorization
// @description                 JWT access token. Format: `Bearer <token>`

// @tag.name         Auth
// @tag.description  Wallet-based authentication (SIWE), session management, and 2FA (TOTP)

// @tag.name         Users
// @tag.description  User profile management, KYC, and admin user operations

// @tag.name         Tokens
// @tag.description  ERC-20 token balance queries and EIP-712 signed meta-transfers

package main
