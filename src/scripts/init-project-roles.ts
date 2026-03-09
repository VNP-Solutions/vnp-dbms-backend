import { PrismaClient, ProjectType } from '@prisma/client'

const prisma = new PrismaClient()

async function initializeProjectRoles() {
  console.log('Initializing project roles...')

  try {
    // Find the Super Admin role
    const superAdminRole = await prisma.userRole.findFirst({
      where: { name: 'Super Admin' }
    })

    if (!superAdminRole) {
      console.error('Super Admin role not found. Please create it first.')
      return
    }

    // Create or update project roles
    const projectRoles = [
      {
        project_type: ProjectType.DBMS,
        name: 'DBMS Access',
        description: 'Main database management system access',
        base_user_role_id: superAdminRole.id,
        is_active: true
      },
      {
        project_type: ProjectType.DASHBOARD,
        name: 'Dashboard Access',
        description: 'Dashboard application access for data visualization',
        base_user_role_id: superAdminRole.id,
        is_active: true
      },
      {
        project_type: ProjectType.PARSER,
        name: 'Parser Access',
        description: 'Parser application access for data processing',
        base_user_role_id: superAdminRole.id,
        is_active: true
      }
    ]

    for (const projectRoleData of projectRoles) {
      const existing = await prisma.projectRole.findFirst({
        where: {
          project_type: projectRoleData.project_type,
          name: projectRoleData.name
        }
      })
      const projectRole = existing
        ? await prisma.projectRole.update({
            where: { id: existing.id },
            data: {
              description: projectRoleData.description,
              base_user_role_id: projectRoleData.base_user_role_id,
              is_active: projectRoleData.is_active
            }
          })
        : await prisma.projectRole.create({
            data: projectRoleData
          })

      console.log(`✓ ${projectRole.project_type} / ${projectRole.name} project role created/updated`)
    }

    console.log('\n✅ Project roles initialized successfully!')
  } catch (error) {
    console.error('Error initializing project roles:', error)
    throw error
  }
}

async function main() {
  await initializeProjectRoles()
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
