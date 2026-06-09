-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "externalPartyName" TEXT,
    "externalPartyContact" TEXT,
    "pdfPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentRequestId" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "approverEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "comments" TEXT,
    "actionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Approver_documentRequestId_fkey" FOREIGN KEY ("documentRequestId") REFERENCES "DocumentRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Approver_documentRequestId_sequence_key" ON "Approver"("documentRequestId", "sequence");
