package main

import (
	"context"

	"github.com/vndc/backend/pkg/blockchain"
	"github.com/vndc/backend/pkg/cache/redis"
	"github.com/vndc/backend/pkg/config"
	"github.com/vndc/backend/pkg/database/mongodb"
	"github.com/vndc/backend/pkg/logger"
)

func createRootContext(log logger.Logger) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	ctx = log.WithContext(ctx)
	return ctx, cancel
}

func connectMongo(ctx context.Context, cfg *config.Config) (*mongodb.Client, error) {
	return mongodb.NewClient(ctx, mongodb.ClientConfig{
		URI:             cfg.Database.URI,
		Database:        cfg.Database.Name,
		MaxPoolSize:     cfg.Database.MaxPoolSize,
		MinPoolSize:     cfg.Database.MinPoolSize,
		MaxConnIdleTime: cfg.Database.MaxConnIdleTime,
		ConnectTimeout:  cfg.Database.ConnectTimeout,
	})
}

func connectRedis(ctx context.Context, cfg *config.Config) (*redis.Client, error) {
	return redis.NewClient(ctx, redis.ClientConfig{
		Addr:         cfg.Cache.Addr,
		Password:     cfg.Cache.Password,
		DB:           cfg.Cache.DB,
		PoolSize:     cfg.Cache.PoolSize,
		MinIdleConns: cfg.Cache.MinIdleConns,
		DialTimeout:  cfg.Cache.DialTimeout,
		ReadTimeout:  cfg.Cache.ReadTimeout,
		WriteTimeout: cfg.Cache.WriteTimeout,
		MaxRetries:   cfg.Cache.MaxRetries,
		KeyPrefix:    cfg.Cache.KeyPrefix,
	})
}

func connectEthereum(ctx context.Context, cfg *config.Config, log logger.Logger) (*blockchain.Client, error) {
	return blockchain.NewClient(ctx, blockchain.ClientConfig{
		RPCURL:               cfg.Blockchain.RPCURL,
		WSURL:                cfg.Blockchain.WSURL,
		ChainID:              cfg.Blockchain.ChainID,
		ConfirmationBlocks:   cfg.Blockchain.ConfirmationBlocks,
		ConfirmationInterval: cfg.Blockchain.ConfirmationInterval,
	}, log)
}
