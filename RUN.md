# VNDC Runbook

Tài liệu này mô tả cách chuẩn bị môi trường, thứ tự khởi động, deploy hợp đồng, chạy backend/frontend, và kiểm tra trạng thái của toàn bộ hệ thống VNDC trên máy local Windows.

Mục tiêu là để bạn có thể khởi động lại dự án một cách nhất quán sau khi tắt máy, reset Hardhat node, hoặc mở lại workspace mà không phải đoán thứ tự chạy từng thành phần.

## 1. Mục tiêu vận hành

VNDC local environment gồm các thành phần sau:

- Backend Go: `http://127.0.0.1:8080`
- Frontend Vite: `http://localhost:5173`
- Hardhat local chain: `http://127.0.0.1:8545` với `chainId = 31337`
- MongoDB local: `mongodb://localhost:27017`
- Redis local: `localhost:6379`

Mô hình khởi động đúng là:

1. Bật hạ tầng dữ liệu và cache.
2. Khởi chạy local blockchain.
3. Deploy lại contract nếu chain vừa reset.
4. Khởi chạy backend.
5. Khởi chạy frontend.
6. Kiểm tra health/ready và mở UI.

## 2. Chuẩn bị một lần duy nhất

Chỉ cần chạy khi máy mới, sau khi xoá `node_modules`, hoặc khi cài lại workspace.

```powershell
cd "d:\Blockchain\VNDC\onchain" ; npm install
cd "d:\Blockchain\VNDC\Frontend\Web\react-vite-ts" ; npm install
cd "d:\Blockchain\VNDC\offchain\backend-go" ; go mod download
```

Nếu bạn dùng Docker cho MongoDB/Redis/Backend thì vẫn nên cài dependencies đầy đủ để có thể chạy từng phần riêng lẻ khi cần debug.

## 3. Trước khi chạy: kiểm tra cấu hình

Trước khi start hệ thống, nên đảm bảo các file cấu hình local đang trỏ đúng endpoint:

- Backend config: [offchain/backend-go/config/config.yaml](offchain/backend-go/config/config.yaml)
- Frontend env: [Frontend/Web/react-vite-ts/.env](Frontend/Web/react-vite-ts/.env)
- Contract addresses: [onchain/deployed-addresses.json](onchain/deployed-addresses.json)

Các giá trị thường dùng trong môi trường local:

```env
VITE_API_BASE_URL=http://localhost:8080/v1
VITE_CHAIN_ID=31337
```

Backend local thường kỳ vọng:

- MongoDB chạy ở `localhost:27017`
- Redis chạy ở `localhost:6379`
- RPC chain ở `http://127.0.0.1:8545`

## 4. Thứ tự chạy thủ công

Nếu bạn muốn debug từng lớp riêng biệt, hãy mở ít nhất 4 terminal riêng.

### Bước 1: khởi động MongoDB

VNDC backend sử dụng MongoDB cho dữ liệu nghiệp vụ, repository, queue trạng thái, và một số luồng cần Change Streams.

#### Cách 1: MongoDB chạy như Windows Service

```powershell
Get-Service | Where-Object { $_.Name -match 'Mongo' -or $_.DisplayName -match 'Mongo' }
Start-Service MongoDB
```

Kiểm tra nhanh:

```powershell
mongosh --eval "db.runCommand({ ping: 1 })"
```

#### Cách 2: MongoDB chạy bằng Docker Compose

Nếu bạn dùng `docker-compose.yml`, service `mongo` đã được cấu hình như replica set để hỗ trợ Change Streams.

Trong trường hợp này bạn không cần start service Mongo riêng trên Windows nữa.

### Bước 2: khởi động Redis

Redis được dùng cho cache balance, blacklist token, và các state tạm khác cần truy cập nhanh.

```powershell
C:\Users\vuvan\redis-server\redis-server.exe
```

Kiểm tra nhanh:

```powershell
redis-cli ping
```

Kết quả đúng phải là `PONG`.

### Bước 3: khởi động Hardhat local chain

Đây là chain local để deploy và test toàn bộ smart contract suite.

```powershell
cd "d:\Blockchain\VNDC\onchain" ; npm run node
```

Kiểm tra nhanh:

```powershell
Test-NetConnection 127.0.0.1 -Port 8545
```

Nếu port mở, local chain đã sẵn sàng nhận deployment và RPC calls.

### Bước 4: deploy hợp đồng khi chain mới reset

Nếu bạn vừa restart Hardhat node từ đầu, toàn bộ state chain cũ sẽ mất. Lúc đó cần deploy lại contract trước khi chạy backend/frontend.

#### 4.1 Compile trước

```powershell
cd "d:\Blockchain\VNDC\onchain"
npm run compile
```

#### 4.2 Deploy các contract chính

```powershell
npm run deploy:token
npm run deploy:staking
npm run deploy:vesting
npm run deploy:task
npm run deploy:funding
npm run deploy:dao
```

#### 4.3 Deploy marketplace và NFT collection

```powershell
npx hardhat run scripts/NFTMarketplace721-deploy.ts --network localhost
npx hardhat run scripts/VNDCErc721Collection-deploy.ts --network localhost
```

#### 4.4 Deploy thêm nếu flow của bạn dùng NFT collection riêng

```powershell
npm run deploy:marketplace
npm run deploy:nft
```

Tùy flow đang test, bạn chỉ cần deploy những contract liên quan. Với NFT Shop, flow hiện dùng `NFTMarketplace721` và `VNDCErc721Collection`.

### Bước 5: cập nhật địa chỉ contract nếu deployment thay đổi

Sau khi deploy lại, nếu địa chỉ contract mới khác trước, hãy đồng bộ các file sau:

- [offchain/backend-go/config/config.yaml](offchain/backend-go/config/config.yaml)
- [Frontend/Web/react-vite-ts/.env](Frontend/Web/react-vite-ts/.env)
- [Frontend/Web/react-vite-ts/src/lib/contracts.ts](Frontend/Web/react-vite-ts/src/lib/contracts.ts)
- [onchain/deployed-addresses.json](onchain/deployed-addresses.json)

Đây là bước rất quan trọng. Nếu bỏ qua, backend hoặc frontend sẽ gọi nhầm contract address cũ và phát sinh lỗi khó debug.

### Bước 6: khởi động backend Go

Backend là lớp nghiệp vụ trung tâm. Chạy từ module root:

```powershell
cd "d:\Blockchain\VNDC\offchain\backend-go" ; go run ./cmd/server
```

Kiểm tra nhanh:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/health | Select-Object StatusCode, Content | Format-List
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/ready | Select-Object StatusCode, Content | Format-List
```

Kết quả mong đợi:

- `/health` trả về `200`.
- `/ready` trả về `200` và trạng thái sẵn sàng kết nối đầy đủ dependency.

### Bước 7: khởi động frontend Vite

```powershell
cd "d:\Blockchain\VNDC\Frontend\Web\react-vite-ts" ; npm run dev
```

Frontend mặc định chạy ở:

```text
http://localhost:5173
```

## 5. Quick start ngắn nhất

Nếu dependencies đã cài sẵn và chain không vừa reset, thứ tự chạy thường dùng là:

```powershell
C:\Users\vuvan\redis-server\redis-server.exe
cd "d:\Blockchain\VNDC\onchain" ; npm run node
cd "d:\Blockchain\VNDC\offchain\backend-go" ; go run ./cmd/server
cd "d:\Blockchain\VNDC\Frontend\Web\react-vite-ts" ; npm run dev
```

MongoDB cần đã được bật trước đó hoặc chạy qua Docker Compose.

## 6. Dùng Docker Compose thay cho chạy thủ công

File [docker-compose.yml](docker-compose.yml) đã mô tả một môi trường local đầy đủ hơn, gồm:

- MongoDB replica set
- Redis
- Hardhat node
- Backend Go
- Mongo Express
- Redis Commander

Chạy toàn bộ stack bằng Compose khi bạn muốn dựng nguyên cụm:

```powershell
cd "d:\Blockchain\VNDC"
docker compose up -d
```

Kiểm tra trạng thái:

```powershell
docker compose ps
```

Phương án Docker phù hợp hơn nếu bạn muốn môi trường gần production hoặc cần khởi động nguyên cụm mà không phụ thuộc vào service cài trực tiếp trên Windows.

## 7. Check nhanh toàn hệ thống

### Backend

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/health | Select-Object StatusCode, Content | Format-List
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/ready | Select-Object StatusCode, Content | Format-List
```

### Frontend

Mở trình duyệt tại:

```text
http://localhost:5173
```

### Chain

```powershell
Test-NetConnection 127.0.0.1 -Port 8545
```

### Redis

```powershell
redis-cli ping
```

### MongoDB

```powershell
mongosh --eval "db.runCommand({ ping: 1 })"
```

## 8. Khi Hardhat node bị reset

Sau khi restart local chain, bạn phải coi blockchain state như mới hoàn toàn.

Quy trình đúng là:

1. Start Hardhat node.
2. Deploy lại contract.
3. Cập nhật address nếu có thay đổi.
4. Restart backend nếu backend đang cache address cũ trong memory.
5. Restart frontend nếu frontend đang giữ config address cũ trong bundle hoặc env.

Nếu không làm bước này, các flow như transfer, DAO, funding, marketplace hoặc ticketing có thể trỏ nhầm sang contract address đã mất.

## 9. Lỗi hay gặp và cách xử lý

### Port 8080 đã bị chiếm

Tìm tiến trình đang giữ port:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
```

Xem process tương ứng:

```powershell
Get-Process -Id <PID>
```

Kill tiến trình cũ:

```powershell
taskkill /F /PID <PID>
```

Sau đó chạy lại backend:

```powershell
cd "d:\Blockchain\VNDC\offchain\backend-go" ; go run ./cmd/server
```

### Backend báo không kết nối được MongoDB hoặc Redis

Kiểm tra lại:

- MongoDB đã chạy chưa.
- Redis đã chạy chưa.
- Cấu hình trong [offchain/backend-go/config/config.yaml](offchain/backend-go/config/config.yaml) có đúng host/port không.
- Nếu dùng Docker Compose, backend phải trỏ vào service name nội bộ thay vì `localhost`.

### Frontend không gọi được API

Kiểm tra [Frontend/Web/react-vite-ts/.env](Frontend/Web/react-vite-ts/.env) có cấu hình đúng:

```env
VITE_API_BASE_URL=http://localhost:8080/v1
VITE_CHAIN_ID=31337
```

Sau khi sửa `.env`, cần restart lại `npm run dev`.

### Deploy xong nhưng UI vẫn gọi sai contract

Làm lại 3 bước:

1. Cập nhật [onchain/deployed-addresses.json](onchain/deployed-addresses.json).
2. Sync lại [Frontend/Web/react-vite-ts/src/lib/contracts.ts](Frontend/Web/react-vite-ts/src/lib/contracts.ts).
3. Restart frontend và backend.

## 10. Lệnh dừng nhanh

Nếu muốn dừng toàn bộ tiến trình local đang chạy:

```powershell
taskkill /F /IM node.exe 2>&1
taskkill /F /IM go.exe 2>&1
taskkill /F /IM server.exe 2>&1
taskkill /F /IM redis-server.exe 2>&1
```

Nếu bạn chạy bằng Docker Compose:

```powershell
cd "d:\Blockchain\VNDC"
docker compose down
```

Nếu chỉ muốn dừng một service cụ thể, nên kill theo PID thay vì kill toàn bộ process cùng tên.

## 11. Workflow khuyến nghị mỗi lần mở máy

1. Bật MongoDB hoặc khởi động `docker compose up -d`.
2. Bật Redis nếu chưa chạy trong Compose.
3. Bật Hardhat node.
4. Nếu chain mới reset, deploy lại contract local.
5. Bật backend và check `/ready`.
6. Bật frontend và mở `http://localhost:5173`.

## 12. Các file cần nhớ

- [RUN.md](RUN.md): runbook local của dự án
- [README.md](README.md): portfolio / overview dự án
- [docker-compose.yml](docker-compose.yml): dựng môi trường local bằng Docker
- [offchain/backend-go/config/config.yaml](offchain/backend-go/config/config.yaml): cấu hình backend local
- [Frontend/Web/react-vite-ts/.env](Frontend/Web/react-vite-ts/.env): cấu hình frontend local
- [onchain/deployed-addresses.json](onchain/deployed-addresses.json): địa chỉ contract local