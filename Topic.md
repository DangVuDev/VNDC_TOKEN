# Đề Tài Tốt Nghiệp: Thiết Kế Và Triển Khai Hệ Thống Token VNDC Ứng Dụng Công Nghệ Blockchain Trong Môi Trường Đại Học

## 1. Giới Thiệu Đề Tài

**Tên đề tài đầy đủ:**  
Thiết kế và triển khai hệ thống token VNDC ứng dụng công nghệ Blockchain trong môi trường đại học (DApp).

**Mô tả ý tưởng chính:**  
Xây dựng một **Decentralized Application (DApp)** sử dụng token kỹ thuật số mang tên **VNDC** (Vietnamese Digital Campus Coin hoặc Vietnamese National Digital Credit – có thể điều chỉnh tên tùy theo ý nghĩa). Token này hoạt động trên blockchain (Ethereum, Polygon, BSC…) và được dùng như một đơn vị giá trị nội bộ phi tập trung trong trường đại học. Đề tài tập trung vào việc áp dụng blockchain để giải quyết các vấn đề thực tế trong giáo dục đại học, như gian lận bằng cấp, thiếu minh bạch tài chính, thủ tục hành chính rườm rà, thiếu động lực sinh viên, tham nhũng trong phân bổ quỹ, bảo mật dữ liệu, và khó khăn trong hợp tác quốc tế.

Dựa trên các nghiên cứu từ các nguồn uy tín như World Economic Forum, American Council on Education (ACE), ScienceDirect, PMC, EdTech Magazine, Oracle, Maryville University, Built In, A3Logics, IEEE, MDPI, và arXiv, blockchain có tiềm năng lớn trong giáo dục bằng cách đảm bảo tính minh bạch (transparency), bất biến (immutability), phi tập trung (decentralization), và bảo mật cao. Các ứng dụng thực tế từ các trường như MIT (Blockcerts), University of Utah, Stanford, Maryville, và các dự án như Edgecoin, Open Campus, Woolf University đã chứng minh hiệu quả.

**Lý do chọn đề tài:**  
- Kết hợp xu hướng nóng: Blockchain + EdTech + Web3.  
- Giải quyết vấn đề thực tiễn tại các trường đại học Việt Nam: thủ tục hành chính rườm rà, gian lận bằng cấp, quản lý điểm rèn luyện thiếu minh bạch, thiếu động lực học tập.  
- Đồ án có tính sáng tạo, kỹ thuật cao (smart contract + DApp frontend), dễ demo và có tiềm năng ứng dụng thực tế.  
- Chi phí phát triển thấp (dùng testnet), phù hợp đồ án tốt nghiệp.

**Phạm vi:**  
- Tập trung vào môi trường một trường đại học (giả định hoặc thực tế).  
- MVP: Tập trung vào các ứng dụng cốt lõi như thanh toán nội bộ, phần thưởng, và chứng chỉ NFT.  
- Không bao gồm: Tích hợp fiat phức tạp, scale toàn quốc ngay từ đầu.

## 2. Mục Tiêu Đề Tài

**Mục tiêu chính:**  
- Xây dựng hệ thống thanh toán & phần thưởng minh bạch, immutable (không thể sửa đổi).  
- Tăng động lực tham gia của sinh viên thông qua token hóa phần thưởng và gamification.  
- Số hóa credentials (chứng chỉ, bảng điểm) dưới dạng NFT để chống gian lận và dễ xác thực.  
- Tạo DApp thân thiện, dễ sử dụng với ví blockchain phổ biến (MetaMask, WalletConnect).  
- Đảm bảo tính phi tập trung, giảm trung gian, và tối ưu hóa cho môi trường đại học Việt Nam.

**Mục tiêu cụ thể:**  
- Giải quyết các vấn đề thực tế như gian lận bằng cấp (giảm 90% thời gian verify theo MIT Blockcerts), thiếu minh bạch tài chính (theo World Economic Forum), thiếu động lực sinh viên (tăng engagement 20-50% theo nghiên cứu ScienceDirect), và thủ tục hành chính rườm rà (tự động hóa qua smart contract).  
- Triển khai ít nhất 5-10 ứng dụng MVP từ danh sách dưới đây, với đánh giá thang điểm dựa trên tính cần thiết, dễ triển khai, tiềm năng impact, và lợi thế blockchain.  
- Đánh giá hiệu suất hệ thống qua testing on-chain (phí gas, tốc độ, bảo mật).

## 3. Các Ứng Dụng Của Token VNDC Trong Môi Trường Đại Học

Dưới đây là 20 ứng dụng tiêu biểu cho token VNDC dưới dạng DApp, dựa trên các vấn đề phổ biến ở trường đại học (theo các nguồn như World Economic Forum, ACE, ScienceDirect, PMC, EdTech Magazine, Oracle, Maryville University, Built In, A3Logics, IEEE, MDPI, arXiv). Mỗi ứng dụng sử dụng token ERC-20/NFT, tập trung vào tính phi tập trung và giải quyết vấn đề cụ thể. Đánh giá trên thang điểm 10 dựa trên: tính cần thiết (giải quyết vấn đề nóng), dễ triển khai & demo, tiềm năng engagement & impact, tính phi tập trung.

| STT | Ứng dụng (Use Case) | Mô tả ngắn gọn trong DApp (với token VNDC) | Vấn đề giải quyết chính (dựa trên tài nguyên mạng) | Điểm /10 | Lý do điểm |
|-----|---------------------|--------------------------------------------|-----------------------------------------------------|----------|-----------|
| 1 | Credential Verification (Diplomas & Transcripts) | Mint NFT cho bằng cấp/bảng điểm, verify on-chain qua ví MetaMask. | Gian lận bằng cấp phổ biến (fake diplomas), verify chậm (MIT Blockcerts giảm 90% thời gian). | 9.8 | Cao nhất vì impact lớn, dễ triển khai, đã áp dụng rộng (MIT, Maryville). |
| 2 | Micro-Credentials & Badges | Mint NFT badge cho kỹ năng ngắn hạn, tích lũy VNDC để upgrade. | Thiếu chứng chỉ linh hoạt, khó verify micro-learning (A3Logics, Open Campus). | 9.5 | Rất cần thiết cho lifelong learning, engagement cao. |
| 3 | Student Records Management | Lưu trữ hồ sơ sinh viên on-chain, cập nhật immutable. | Data breach và mất mát hồ sơ (PMC, Oracle báo cáo). | 9.2 | Minh bạch cao, nhưng cần oracle cho data input. |
| 4 | Tuition & Fees Payment | Transfer VNDC để nộp học phí, smart contract confirm tự động. | Thanh toán chậm, thiếu minh bạch (EdTech Magazine, World Economic Forum). | 9.0 | Giải quyết tài chính nóng ở VN, phí thấp trên Polygon. |
| 5 | Internal Campus Payments (Canteen, Photocopy) | QR code transfer VNDC tại quầy, merchant nhận tức thì. | Tiền mặt mất an toàn, xếp hàng lâu (Built In, A3Logics). | 8.8 | Dễ demo, tăng tiện lợi hàng ngày. |
| 6 | Rewards for Academic Performance (GPA, Courses) | Mint VNDC tự động cho GPA cao/hoàn thành môn. | Thiếu động lực học tập, dropout cao (ScienceDirect, arXiv). | 9.3 | Gamification mạnh, tăng engagement 20-50%. |
| 7 | Rewards for Extracurricular Activities | Claim VNDC sau tham gia sự kiện/tình nguyện (sign message). | Ít tham gia ngoại khóa, điểm rèn luyện chủ quan (PMC, IEEE). | 8.7 | Tăng động lực xã hội, dễ tích hợp. |
| 8 | Scholarships & Funding Management | Mint VNDC học bổng, theo dõi on-chain. | Phân bổ học bổng thiếu minh bạch, chậm (ACE, MDPI). | 8.9 | Chống tham nhũng, minh bạch quỹ. |
| 9 | Research Data Sharing | Lưu trữ dữ liệu nghiên cứu on IPFS, access qua VNDC stake. | Khó chia sẻ dữ liệu lớn, thiếu access toàn cầu (University of Utah, World Economic Forum). | 8.5 | Hay cho nghiên cứu, nhưng phức tạp hơn. |
| 10 | Intellectual Property Management | NFT cho ý tưởng/bài nghiên cứu, royalty VNDC khi sử dụng. | Trộm cắp IP, khó bảo vệ (ScienceDirect, IEEE). | 8.4 | Bảo vệ sáng tạo, phù hợp trường nghiên cứu. |
| 11 | Governance & Student Voting (Council, Events) | Vote weighted bằng VNDC cho hội SV/sự kiện. | Bầu cử thiếu minh bạch, gian lận phiếu (PMC, arXiv). | 9.1 | Tăng dân chủ, DAO-like (Woolf University). |
| 12 | Feedback & Evaluation Systems | Submit feedback ẩn danh, earn VNDC reward. | Đánh giá giảng viên chủ quan, ít tham gia (ScienceDirect, IEEE). | 8.6 | Incentivize chất lượng, ẩn danh bảo vệ. |
| 13 | Resource Booking (Rooms, Labs) | Pay VNDC để book slot, smart contract lock. | Xếp hàng, lãng phí tài nguyên (EdTech, A3Logics). | 8.2 | Tự động hóa hành chính, công bằng. |
| 14 | Lifelong Learning Records | Tích lũy VNDC/NFT cho học tập suốt đời. | Chứng chỉ không liên kết, khó theo dõi (ACE, MDPI). | 8.7 | Hỗ trợ mobility, global recognition. |
| 15 | Collaborative Learning Platforms | Share kiến thức, earn VNDC từ contribution. | Thiếu hợp tác, data không an toàn (World Economic Forum, PMC). | 8.0 | Khuyến khích peer-to-peer, nhưng cần scale. |
| 16 | Gamification of Learning (Quizzes, Tasks) | Earn VNDC từ quiz/online task. | Dropout môn học, thiếu tương tác (arXiv, Built In). | 8.9 | Tăng engagement mạnh, dễ viral. |
| 17 | Secure Storage for OpenCourseWare | Lưu tài liệu khóa học on blockchain/IPFS. | Nội dung dễ mất, khó bảo tồn (MIT OpenCourseWare). | 7.8 | Hay cho mở rộng kiến thức, nhưng ít token hóa. |
| 18 | Student ID Tokenization (NFTs) | NFT cho ID sinh viên, access dịch vụ. | ID giả mạo, khó quản lý (PMC, Oracle). | 8.3 | Bảo mật cao, dễ integrate. |
| 19 | Crowdfunding for Student Projects | Donate VNDC cho dự án SV, matching fund. | Khó huy động vốn khởi nghiệp (A3Logics, IEEE). | 8.1 | Khuyến khích innovation, minh bạch. |
| 20 | Staking for Educational Incentives | Stake VNDC kiếm lãi từ quỹ trường. | Thiếu tiết kiệm, học tài chính (DeFi-inspired từ Built In). | 7.5 | Nâng cao, nhưng rủi ro pháp lý cao hơn. |

## 4. Hướng Phát Triển & Tiềm Năng Tương Lai

### Ngắn hạn (sau tốt nghiệp – 6-12 tháng)  
- Pilot thực tế tại một khoa hoặc trường (100–500 người dùng), bắt đầu với top 5 ứng dụng cao điểm (credential verification, rewards, payments).  
- Tích hợp với hệ thống quản lý sinh viên hiện tại (qua API/Oracle).  
- Audit smart contract chuyên nghiệp (sử dụng tool như MythX).  
- Deploy lên mainnet (Polygon/BSC để phí thấp), đánh giá user feedback.

### Trung hạn (1–3 năm)  
- Mở rộng cross-university: Token VNDC dùng chung giữa các trường (kết nối ĐH Bách Khoa, ĐH Quốc Gia).  
- Hợp tác doanh nghiệp: Chấp nhận VNDC để tuyển dụng, internship, sponsor (tích hợp DeFi mini như staking).  
- Thêm NFT marketplace nội bộ (trade badge, dữ liệu nghiên cứu).  
- Tích hợp AI để phân tích hành vi học tập → thưởng token tự động, giải quyết vấn đề dropout cao.

### Dài hạn  
- Xây dựng hệ sinh thái EdWeb3 Việt Nam (kết nối trường – doanh nghiệp – sinh viên), giải quyết vấn đề toàn cầu hóa (chứng chỉ công nhận quốc tế).  
- Chuyển sang Layer 2 hoặc chain nội địa để tối ưu phí và scalability (giải quyết challenge interoperability theo World Economic Forum).  
- Mở rộng sang giáo dục phổ thông, đào tạo nghề, với trọng tâm chống gian lận và minh bạch.  
- Nghiên cứu thêm về privacy (ZK-proofs) để bảo vệ dữ liệu cá nhân, theo khuyến nghị từ PMC và IEEE.

## 5. Công Nghệ Dự Kiến  
- **Blockchain**: Ethereum (testnet Sepolia), Polygon, BSC.  
- **Smart Contract**: Solidity + OpenZeppelin (ERC-20 cho VNDC, ERC-721/1155 cho NFT).  
- **Frontend DApp**: React.js + Ethers.js/Web3.js + TailwindCSS.  
- **Lưu trữ phi tập trung**: IPFS (metadata NFT).  
- **Công cụ phát triển**: Hardhat, Remix, Ganache.  
- **Wallet**: MetaMask integration.

## Kết Luận  
Đề tài này không chỉ đáp ứng yêu cầu tốt nghiệp mà còn mang tính ứng dụng cao, góp phần thúc đẩy chuyển đổi số và giáo dục blockchain tại Việt Nam. Hệ thống VNDC có tiềm năng trở thành mô hình mẫu mực cho các trường đại học khác, kết hợp giữa công nghệ hiện đại và nhu cầu thực tiễn.

**Ngày soạn thảo:** Tháng 2/2026  
**Tác giả:** [Tên của bạn]